import { pool } from "./db.js";

export const initialDatabase = async () => {
  let connection;

  try {
    connection = await pool.getConnection();

    // 1. users
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 2. categories
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        parent_id INT UNSIGNED DEFAULT NULL,
        name VARCHAR(225) NOT NULL,
        slug VARCHAR(225) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    // 3. products
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        category_id INT UNSIGNED NOT NULL,
        name VARCHAR(225) NOT NULL,
        slug VARCHAR(225) UNIQUE NOT NULL,
        description TEXT,
        best_price DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
        FULLTEXT (name)
      )
    `);

    // 4. product_variants
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        product_id INT UNSIGNED NOT NULL,
        sku VARCHAR(225) UNIQUE NOT NULL,
        name VARCHAR(225) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // 5. product_images
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_img (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        product_id INT UNSIGNED NOT NULL,
        url VARCHAR(225) NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // 6. inventory
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        product_variant_id INT UNSIGNED NOT NULL UNIQUE,
        stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
        low_stock_threshold INT DEFAULT 5,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
      )
    `);

    // 7. shipping_addresses  (must be before orders)
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        CONSTRAINT fk_shipping_user 
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 8. carts
    await connection.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 9. cart_items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        cart_id INT UNSIGNED NOT NULL,
        product_variant_id INT UNSIGNED NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (cart_id, product_variant_id),
        FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
      )
    `);

    // 10. orders (after shipping_addresses)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,

        -- snapshot of the address at order time
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
        order_status ENUM('pending','paid','processing','shipped','delivered','cancelled')
          NOT NULL DEFAULT 'pending',

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (shipping_address_id) REFERENCES shipping_addresses(id) ON DELETE SET NULL
      )
    `);

    // 11. order_items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id INT UNSIGNED NOT NULL,
        product_variant_id INT UNSIGNED NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
      )
    `);

    // 12. payments
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id INT UNSIGNED NOT NULL,
        tx_ref VARCHAR(100) NOT NULL UNIQUE,
        payment_gateway VARCHAR(50) NOT NULL,
        transaction_id VARCHAR(225) NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'ETB',
        status ENUM('pending','completed','failed','cancelled','expired','refunded')
          NOT NULL DEFAULT 'pending',
        failure_reason VARCHAR(255) NULL,
        gateway_response JSON NULL,
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        completed_order_id INT UNSIGNED GENERATED ALWAYS AS (
          CASE WHEN status = 'completed' THEN order_id ELSE NULL END
        ) VIRTUAL,

        UNIQUE KEY uq_gateway_transaction (payment_gateway, transaction_id),
        UNIQUE KEY uq_one_completed_per_order (completed_order_id),
        KEY idx_payments_order_status (order_id, status),

        CONSTRAINT fk_payments_order
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
        CONSTRAINT chk_payments_amount CHECK (amount > 0)
      )
    `);

    // 13. deliveries
    await connection.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id INT UNSIGNED NOT NULL,
        tracking_number VARCHAR(100),
        carrier VARCHAR(100),
        status ENUM('preparing','dispatched','in_transit','delivered','returned')
          DEFAULT 'preparing',
        shipped_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    console.log("✅ Database tables created successfully");
  } catch (error) {
    console.error("❌ Database table initialize error:", error.message);
  } finally {
    if (connection) connection.release();
  }
};
