// config/initDb.js  (or wherever you keep it)
import { pool } from "./db.js";

/**
 * Creates the full schema if missing.
 * Production notes:
 * - utf8mb4 + InnoDB everywhere
 * - Product variants: size, color, color_hex, compare_at_price
 * - product_images (not product_img): view_type, color, alt, is_primary, sort_order
 * - Indexes for list/filter and unique business keys
 * - Order address snapshot + optional line-item catalog snapshot columns
 * - Fails hard on error so the process does not boot on a broken schema
 *
 * For existing databases, prefer versioned migrations instead of relying
 * only on CREATE TABLE IF NOT EXISTS (it will not add new columns).
 */
export const initialDatabase = async () => {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

    // ------------------------------------------------------------------
    // 1. users
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_users_email (email),
        KEY idx_users_role_active (role, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 2. categories
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        parent_id INT UNSIGNED NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_categories_slug (slug),
        KEY idx_categories_parent (parent_id),
        KEY idx_categories_active (is_active),
        CONSTRAINT fk_categories_parent
          FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 3. products
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        category_id INT UNSIGNED NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT NULL,
        best_price DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_products_slug (slug),
        KEY idx_products_category (category_id),
        KEY idx_products_active_id (is_active, id),
        FULLTEXT KEY ft_products_name (name),
        CONSTRAINT fk_products_category
          FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
        CONSTRAINT chk_products_best_price CHECK (best_price >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 4. product_variants  (size / color / hex / compare_at for admin UI)
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        product_id INT UNSIGNED NOT NULL,
        sku VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        size VARCHAR(50) NULL,
        color VARCHAR(50) NULL,
        color_hex CHAR(7) NULL,
        price DECIMAL(10,2) NOT NULL,
        compare_at_price DECIMAL(10,2) NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_variants_sku (sku),
        KEY idx_variants_product (product_id),
        KEY idx_variants_product_active (product_id, is_active),
        CONSTRAINT fk_variants_product
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
        CONSTRAINT chk_variants_price CHECK (price > 0),
        CONSTRAINT chk_variants_compare CHECK (
          compare_at_price IS NULL OR compare_at_price > price
        ),
        CONSTRAINT chk_variants_hex CHECK (
          color_hex IS NULL OR color_hex REGEXP '^#[0-9A-Fa-f]{6}$'
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 5. product_images  (multi-view gallery; name matches service models)
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        product_id INT UNSIGNED NOT NULL,
        url VARCHAR(512) NOT NULL,
        view_type VARCHAR(32) NOT NULL DEFAULT 'front',
        color VARCHAR(50) NULL,
        alt VARCHAR(255) NULL,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_images_product (product_id),
        KEY idx_images_product_sort (product_id, sort_order),
        KEY idx_images_product_primary (product_id, is_primary),
        CONSTRAINT fk_images_product
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
        CONSTRAINT chk_images_view CHECK (
          view_type IN (
            'front', 'back', 'side', 'left', 'right',
            'top', 'bottom', 'detail', 'model', 'lifestyle'
          )
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 6. inventory
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        product_variant_id INT UNSIGNED NOT NULL,
        stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
        low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 5,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_inventory_variant (product_variant_id),
        CONSTRAINT fk_inventory_variant
          FOREIGN KEY (product_variant_id) REFERENCES product_variants (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 7. shipping_addresses  (before orders)
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shipping_addresses (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        full_name VARCHAR(120) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        region VARCHAR(80) NOT NULL,
        city VARCHAR(80) NOT NULL,
        sub_city VARCHAR(80) NULL,
        woreda VARCHAR(80) NULL,
        street VARCHAR(150) NULL,
        landmark VARCHAR(150) NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_shipping_user (user_id),
        KEY idx_shipping_user_default (user_id, is_default),
        CONSTRAINT fk_shipping_user
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 8. carts
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_carts_user (user_id),
        CONSTRAINT fk_carts_user
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 9. cart_items
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        cart_id INT UNSIGNED NOT NULL,
        product_variant_id INT UNSIGNED NOT NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cart_item (cart_id, product_variant_id),
        KEY idx_cart_items_variant (product_variant_id),
        CONSTRAINT fk_cart_items_cart
          FOREIGN KEY (cart_id) REFERENCES carts (id) ON DELETE CASCADE,
        CONSTRAINT fk_cart_items_variant
          FOREIGN KEY (product_variant_id) REFERENCES product_variants (id) ON DELETE CASCADE,
        CONSTRAINT chk_cart_items_qty CHECK (quantity > 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 10. orders  (address snapshot at order time)
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,

        shipping_full_name VARCHAR(120) NOT NULL,
        shipping_phone VARCHAR(20) NOT NULL,
        shipping_region VARCHAR(80) NOT NULL,
        shipping_city VARCHAR(80) NOT NULL,
        shipping_sub_city VARCHAR(80) NULL,
        shipping_woreda VARCHAR(80) NULL,
        shipping_street VARCHAR(150) NULL,
        shipping_landmark VARCHAR(150) NULL,

        shipping_address_id INT UNSIGNED NULL,

        total_amount DECIMAL(10,2) NOT NULL,
        order_status ENUM(
          'pending',
          'paid',
          'processing',
          'shipped',
          'delivered',
          'cancelled'
        ) NOT NULL DEFAULT 'pending',

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        KEY idx_orders_user (user_id),
        KEY idx_orders_status_created (order_status, created_at),
        KEY idx_orders_shipping_address (shipping_address_id),
        CONSTRAINT fk_orders_user
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT fk_orders_shipping_address
          FOREIGN KEY (shipping_address_id) REFERENCES shipping_addresses (id)
          ON DELETE SET NULL,
        CONSTRAINT chk_orders_total CHECK (total_amount >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 11. order_items  (+ catalog snapshot for stable history)
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id INT UNSIGNED NOT NULL,
        product_variant_id INT UNSIGNED NOT NULL,

        product_name VARCHAR(255) NULL,
        variant_sku VARCHAR(64) NULL,
        variant_size VARCHAR(50) NULL,
        variant_color VARCHAR(50) NULL,

        quantity INT UNSIGNED NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        KEY idx_order_items_order (order_id),
        KEY idx_order_items_variant (product_variant_id),
        CONSTRAINT fk_order_items_order
          FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_order_items_variant
          FOREIGN KEY (product_variant_id) REFERENCES product_variants (id)
          ON DELETE RESTRICT,
        CONSTRAINT chk_order_items_qty CHECK (quantity > 0),
        CONSTRAINT chk_order_items_price CHECK (unit_price >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 12. payments
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id INT UNSIGNED NOT NULL,
        tx_ref VARCHAR(100) NOT NULL,
        payment_gateway VARCHAR(50) NOT NULL,
        transaction_id VARCHAR(255) NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'ETB',
        status ENUM(
          'pending',
          'completed',
          'failed',
          'cancelled',
          'expired',
          'refunded'
        ) NOT NULL DEFAULT 'pending',
        failure_reason VARCHAR(255) NULL,
        gateway_response JSON NULL,
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        completed_order_id INT UNSIGNED
          GENERATED ALWAYS AS (
            CASE WHEN status = 'completed' THEN order_id ELSE NULL END
          ) VIRTUAL,

        UNIQUE KEY uq_payments_tx_ref (tx_ref),
        UNIQUE KEY uq_gateway_transaction (payment_gateway, transaction_id),
        UNIQUE KEY uq_one_completed_per_order (completed_order_id),
        KEY idx_payments_order_status (order_id, status),
        CONSTRAINT fk_payments_order
          FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
        CONSTRAINT chk_payments_amount CHECK (amount > 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------------
    // 13. deliveries
    // ------------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id INT UNSIGNED NOT NULL,
        tracking_number VARCHAR(100) NULL,
        carrier VARCHAR(100) NULL,
        status ENUM(
          'preparing',
          'dispatched',
          'in_transit',
          'delivered',
          'returned'
        ) NOT NULL DEFAULT 'preparing',
        shipped_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_deliveries_order (order_id),
        KEY idx_deliveries_tracking (tracking_number),
        CONSTRAINT fk_deliveries_order
          FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log("✅ Database tables created successfully");
  } catch (error) {
    console.error("❌ Database table initialize error:", error.message);
    console.error(error);
    // Fail boot in production so the app never runs against a broken schema
    throw error;
  } finally {
    if (connection) connection.release();
  }
};
