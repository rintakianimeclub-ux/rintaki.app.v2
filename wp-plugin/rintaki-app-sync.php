<?php
/**
 * Plugin Name: Rintaki App Sync
 * Description: Exposes MyCred points, Anime Cash, and PMPro membership level to the Rintaki mobile app, and accepts adjustments. Secured with a shared secret.
 * Version:     1.4.0
 * Author:      Rintaki Anime Club Society
 */

if (!defined('ABSPATH')) { exit; }

/**
 * IMPORTANT: Replace this secret with the one your app is configured with,
 * or keep it as-is since we set it for you already.
 * Never expose this key publicly.
 */
define('RINTAKI_APP_SECRET', 'Pjf3h_9gbXBaoZdIfojkrWmvuwfc9vMF9-E6NEmGT5s');

/** MyCred point-type slugs (must match MyCred → Points → Point Types). */
define('RINTAKI_POINTS_TYPE', 'mycred_default');
define('RINTAKI_CASH_TYPE',   'anime_cash');

/** Permission callback — checks the X-Rintaki-Key header. */
function rintaki_app_check_key(WP_REST_Request $req) {
    $provided = (string) $req->get_header('x-rintaki-key');
    if (empty($provided)) { return false; }
    return hash_equals(RINTAKI_APP_SECRET, $provided);
}

/** Helper: get a MyCred balance, gracefully returning 0 if MyCred isn't active. */
function rintaki_app_balance($user_id, $type) {
    if (function_exists('mycred_get_users_balance')) {
        return (float) mycred_get_users_balance($user_id, $type);
    }
    return 0.0;
}

/** Helper: return user's active PMPro membership level or {level:0} if none. */
function rintaki_app_membership($user_id) {
    if (function_exists('pmpro_getMembershipLevelForUser')) {
        $lvl = pmpro_getMembershipLevelForUser($user_id);
        if ($lvl && !empty($lvl->ID)) {
            return [
                'level' => (int) $lvl->ID,
                'name'  => isset($lvl->name) ? (string) $lvl->name : '',
            ];
        }
    }
    return ['level' => 0, 'name' => ''];
}

add_action('rest_api_init', function () {

    // GET /wp-json/rintaki/v1/balance?email=foo@bar.com
    register_rest_route('rintaki/v1', '/balance', [
        'methods'             => 'GET',
        'permission_callback' => 'rintaki_app_check_key',
        'callback'            => function (WP_REST_Request $req) {
            $email = sanitize_email((string) $req->get_param('email'));
            if (empty($email)) {
                return new WP_Error('bad_request', 'email is required', ['status' => 400]);
            }
            $user = get_user_by('email', $email);
            if (!$user) {
                return new WP_REST_Response(['found' => false], 200);
            }
            $membership = rintaki_app_membership($user->ID);
            return new WP_REST_Response([
                'found'            => true,
                'user_id'          => (int) $user->ID,
                'email'            => $user->user_email,
                'display_name'     => $user->display_name,
                'points'           => (int) rintaki_app_balance($user->ID, RINTAKI_POINTS_TYPE),
                'anime_cash'       => (int) rintaki_app_balance($user->ID, RINTAKI_CASH_TYPE),
                'membership_level' => (int) $membership['level'],
                'membership_name'  => (string) $membership['name'],
            ], 200);
        },
    ]);

    // POST /wp-json/rintaki/v1/adjust
    //   body: { email, type: "mycred_default"|"anime_cash", amount: int, reason?: string, ref?: string }
    //   `ref` is an optional external-key the app provides (e.g. "daily_visit:2026-04-23:u12").
    //   When present, the plugin first checks if an entry with the same ref_type+ref_id already exists
    //   and skips the award to guarantee idempotency even on retries.
    register_rest_route('rintaki/v1', '/adjust', [
        'methods'             => 'POST',
        'permission_callback' => 'rintaki_app_check_key',
        'callback'            => function (WP_REST_Request $req) {
            $email  = sanitize_email((string) $req->get_param('email'));
            $type   = (string) $req->get_param('type');
            $amount = (int)    $req->get_param('amount');
            $reason = sanitize_text_field((string) ($req->get_param('reason') ?: 'Rintaki app activity'));
            $ref    = sanitize_text_field((string) ($req->get_param('ref') ?: ''));

            if (empty($email))  { return new WP_Error('bad_request', 'email is required', ['status' => 400]); }
            if ($amount === 0)  { return new WP_REST_Response(['ok' => true, 'skipped' => true], 200); }
            if (!in_array($type, [RINTAKI_POINTS_TYPE, RINTAKI_CASH_TYPE], true)) {
                return new WP_Error('bad_type', 'Unknown type', ['status' => 400]);
            }
            if (!function_exists('mycred_add')) {
                return new WP_Error('no_mycred', 'MyCred is not installed / active', ['status' => 500]);
            }
            $user = get_user_by('email', $email);
            if (!$user) { return new WP_Error('not_found', 'User not found on WordPress', ['status' => 404]); }

            // Idempotency: if this ref has already been credited, return the current balance.
            if (!empty($ref) && function_exists('mycred_has_entry')) {
                $already = mycred_has_entry('rintaki_app', 0, (int) $user->ID, ['ref' => $ref], $type);
                if ($already) {
                    return new WP_REST_Response([
                        'ok' => true, 'skipped' => true, 'reason' => 'already_credited',
                        'new_balance' => (int) rintaki_app_balance($user->ID, $type),
                    ], 200);
                }
            }

            // Store the ref inside MyCred's $data array so it can be queried and shown in logs.
            $data = empty($ref) ? [] : ['ref' => $ref];
            mycred_add('rintaki_app', (int) $user->ID, $amount, $reason, 0, $data, $type);
            $new_balance = (int) rintaki_app_balance($user->ID, $type);
            return new WP_REST_Response(['ok' => true, 'new_balance' => $new_balance, 'ref' => $ref], 200);
        },
    ]);

    // GET /wp-json/rintaki/v1/profile?email=foo@bar.com
    // Returns WP user + PMPro checkout fields so the app can show the same info the member entered at checkout.
    register_rest_route('rintaki/v1', '/profile', [
        'methods'             => 'GET',
        'permission_callback' => 'rintaki_app_check_key',
        'callback'            => function (WP_REST_Request $req) {
            $email = sanitize_email((string) $req->get_param('email'));
            if (empty($email)) {
                return new WP_Error('bad_request', 'email is required', ['status' => 400]);
            }
            $user = get_user_by('email', $email);
            if (!$user) {
                return new WP_REST_Response(['found' => false], 200);
            }
            $uid = (int) $user->ID;
            // PMPro billing fields are stored as usermeta with pmpro_b* prefix
            $fields = [
                'first_name' => get_user_meta($uid, 'first_name', true),
                'last_name'  => get_user_meta($uid, 'last_name', true),
                'pmpro_bfirstname' => get_user_meta($uid, 'pmpro_bfirstname', true),
                'pmpro_blastname'  => get_user_meta($uid, 'pmpro_blastname', true),
                'pmpro_baddress1'  => get_user_meta($uid, 'pmpro_baddress1', true),
                'pmpro_baddress2'  => get_user_meta($uid, 'pmpro_baddress2', true),
                'pmpro_bcity'      => get_user_meta($uid, 'pmpro_bcity', true),
                'pmpro_bstate'     => get_user_meta($uid, 'pmpro_bstate', true),
                'pmpro_bzipcode'   => get_user_meta($uid, 'pmpro_bzipcode', true),
                'pmpro_bcountry'   => get_user_meta($uid, 'pmpro_bcountry', true),
                'pmpro_bphone'     => get_user_meta($uid, 'pmpro_bphone', true),
            ];
            $membership = rintaki_app_membership($uid);
            return new WP_REST_Response([
                'found'            => true,
                'user_id'          => $uid,
                'email'            => $user->user_email,
                'username'         => $user->user_login,
                'display_name'     => $user->display_name,
                'registered'       => $user->user_registered,
                'first_name'       => $fields['first_name'] ?: $fields['pmpro_bfirstname'],
                'last_name'        => $fields['last_name']  ?: $fields['pmpro_blastname'],
                'phone'            => $fields['pmpro_bphone'],
                'address1'         => $fields['pmpro_baddress1'],
                'address2'         => $fields['pmpro_baddress2'],
                'city'             => $fields['pmpro_bcity'],
                'state'            => $fields['pmpro_bstate'],
                'zip'              => $fields['pmpro_bzipcode'],
                'country'          => $fields['pmpro_bcountry'],
                'membership_level' => (int) $membership['level'],
                'membership_name'  => (string) $membership['name'],
                'edit_url'         => site_url('/membership-account/'),
            ], 200);
        },
    ]);

    // GET /wp-json/rintaki/v1/ping — quick health check
    register_rest_route('rintaki/v1', '/ping', [
        'methods'             => 'GET',
        'permission_callback' => 'rintaki_app_check_key',
        'callback'            => function () {
            global $wpdb;
            $topics_table = $wpdb->prefix . 'forum_topics';
            $posts_table  = $wpdb->prefix . 'forum_posts';
            $has_tables   = (
                $wpdb->get_var("SHOW TABLES LIKE '$topics_table'") === $topics_table &&
                $wpdb->get_var("SHOW TABLES LIKE '$posts_table'")  === $posts_table
            );
            return [
                'ok'            => true,
                'mycred_active' => function_exists('mycred_get_users_balance'),
                'pmpro_active'  => function_exists('pmpro_getMembershipLevelForUser'),
                'asgaros_ready' => $has_tables,
                'points_type'   => RINTAKI_POINTS_TYPE,
                'cash_type'     => RINTAKI_CASH_TYPE,
            ];
        },
    ]);

    // --- Asgaros Forum: resolve topic by slug ---
    // Tries to find the topic_id that matches a URL slug like "trade-cards".
    // Asgaros permalink slugs are built from sanitize_title($topic_name), so we match on that.
    function rintaki_app_resolve_topic_id($slug) {
        global $wpdb;
        $topics = $wpdb->prefix . 'forum_topics';
        if ($wpdb->get_var("SHOW TABLES LIKE '$topics'") !== $topics) return 0;
        // Direct match on a `slug` column if the site's Asgaros version has one
        $cols = $wpdb->get_col("DESC $topics", 0);
        if (in_array('slug', $cols, true)) {
            $tid = (int) $wpdb->get_var($wpdb->prepare("SELECT id FROM $topics WHERE slug = %s", $slug));
            if ($tid) return $tid;
        }
        // Otherwise match sanitize_title(name)
        $rows = $wpdb->get_results("SELECT id, name FROM $topics", ARRAY_A);
        foreach ((array) $rows as $row) {
            if (sanitize_title($row['name']) === $slug) return (int) $row['id'];
        }
        return 0;
    }

    // POST /wp-json/rintaki/v1/forum-reply
    //   body: { email, topic_slug, text }
    register_rest_route('rintaki/v1', '/forum-reply', [
        'methods'             => 'POST',
        'permission_callback' => 'rintaki_app_check_key',
        'callback'            => function (WP_REST_Request $req) {
            global $wpdb;
            $email = sanitize_email((string) $req->get_param('email'));
            $slug  = sanitize_title((string) $req->get_param('topic_slug'));
            $text  = trim((string) $req->get_param('text'));

            if (empty($email)) return new WP_Error('bad_request', 'email is required', ['status' => 400]);
            if (empty($slug))  return new WP_Error('bad_request', 'topic_slug is required', ['status' => 400]);
            if (empty($text) || strlen($text) > 20000) {
                return new WP_Error('bad_request', 'text must be 1-20000 chars', ['status' => 400]);
            }

            $user = get_user_by('email', $email);
            if (!$user) return new WP_Error('not_found', 'User not on WordPress. Sign up on rintaki.org with this email first.', ['status' => 404]);

            $topic_id = rintaki_app_resolve_topic_id($slug);
            if (!$topic_id) return new WP_Error('not_found', 'Topic not found', ['status' => 404]);

            $posts_table = $wpdb->prefix . 'forum_posts';
            if ($wpdb->get_var("SHOW TABLES LIKE '$posts_table'") !== $posts_table) {
                return new WP_Error('no_forum', 'Asgaros Forum tables missing', ['status' => 500]);
            }

            // Allow simple HTML via WP's post kses (strips dangerous tags).
            $clean_text = wp_kses_post($text);

            $data = [
                'text'      => $clean_text,
                'parent_id' => $topic_id,
                'date'      => current_time('mysql'),
                'author_id' => (int) $user->ID,
            ];
            $formats = ['%s', '%d', '%s', '%d'];
            $ok = $wpdb->insert($posts_table, $data, $formats);
            if ($ok === false) {
                return new WP_Error('insert_failed', 'Could not insert reply: ' . $wpdb->last_error, ['status' => 500]);
            }
            $post_id = (int) $wpdb->insert_id;

            // Fire Asgaros hook so notifications, search index, etc. update.
            if (has_action('asgarosforum_after_add_post')) {
                do_action('asgarosforum_after_add_post', $post_id, $topic_id);
            }

            // Rebuild permalink
            $link = home_url('/notice-board/topic/' . $slug . '/#postid-' . $post_id);

            return new WP_REST_Response([
                'ok'        => true,
                'post_id'   => $post_id,
                'topic_id'  => $topic_id,
                'permalink' => $link,
            ], 200);
        },
    ]);
});
