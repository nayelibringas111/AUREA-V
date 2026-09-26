-- =====================================================================
-- MatrixFlow Enterprise – Esquema PostgreSQL (compatible con Supabase)
-- Generado desde las migraciones Alembic (backend/alembic/versions).
--
-- NORMALMENTE NO NECESITA EJECUTAR ESTE ARCHIVO: el backend en Render ejecuta
-- `alembic upgrade head` al arrancar y crea las tablas automáticamente.
--
-- Úselo solo si prefiere crear el esquema manualmente desde
-- Supabase → SQL Editor. Incluye la tabla alembic_version para que las
-- migraciones posteriores continúen desde aquí.
-- =====================================================================

BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE companies (
    id SERIAL NOT NULL, 
    name VARCHAR(150) NOT NULL, 
    legal_name VARCHAR(200), 
    ruc VARCHAR(20), 
    sector VARCHAR(100), 
    address VARCHAR(255), 
    phone VARCHAR(30), 
    email VARCHAR(150), 
    currency VARCHAR(3) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (ruc)
);

CREATE TABLE roles (
    id SERIAL NOT NULL, 
    name VARCHAR(50) NOT NULL, 
    description VARCHAR(255), 
    permissions JSON NOT NULL, 
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_roles_name ON roles (name);

CREATE TABLE branches (
    id SERIAL NOT NULL, 
    company_id INTEGER NOT NULL, 
    code VARCHAR(20) NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    city VARCHAR(80) NOT NULL, 
    address VARCHAR(255), 
    manager VARCHAR(120), 
    is_active BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
    CONSTRAINT uq_branch_company_code UNIQUE (company_id, code)
);

CREATE INDEX ix_branches_company_id ON branches (company_id);

CREATE TABLE categories (
    id SERIAL NOT NULL, 
    company_id INTEGER NOT NULL, 
    name VARCHAR(100) NOT NULL, 
    description VARCHAR(255), 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
    CONSTRAINT uq_category_company_name UNIQUE (company_id, name)
);

CREATE INDEX ix_categories_company_id ON categories (company_id);

CREATE TABLE users (
    id SERIAL NOT NULL, 
    email VARCHAR(255) NOT NULL, 
    full_name VARCHAR(150) NOT NULL, 
    hashed_password VARCHAR(255) NOT NULL, 
    role_id INTEGER NOT NULL, 
    company_id INTEGER, 
    is_active BOOLEAN NOT NULL, 
    last_login TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE SET NULL, 
    FOREIGN KEY(role_id) REFERENCES roles (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE audit_logs (
    id SERIAL NOT NULL, 
    user_id INTEGER, 
    user_email VARCHAR(255), 
    action VARCHAR(50) NOT NULL, 
    module VARCHAR(50) NOT NULL, 
    entity_id VARCHAR(50), 
    status VARCHAR(20) NOT NULL, 
    detail JSON, 
    ip_address VARCHAR(64), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

CREATE INDEX ix_audit_logs_module ON audit_logs (module);

CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);

CREATE TABLE matrices (
    id SERIAL NOT NULL, 
    company_id INTEGER, 
    name VARCHAR(150) NOT NULL, 
    description TEXT, 
    rows INTEGER NOT NULL, 
    cols INTEGER NOT NULL, 
    row_labels JSON, 
    col_labels JSON, 
    source VARCHAR(40) NOT NULL, 
    created_by INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
    FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_matrices_company_id ON matrices (company_id);

CREATE TABLE operations (
    id SERIAL NOT NULL, 
    operation_type VARCHAR(40) NOT NULL, 
    description VARCHAR(255), 
    status VARCHAR(20) NOT NULL, 
    scalar FLOAT, 
    coefficients JSON, 
    duration_ms FLOAT, 
    error_message TEXT, 
    user_id INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_operations_created_at ON operations (created_at);

CREATE INDEX ix_operations_operation_type ON operations (operation_type);

CREATE INDEX ix_operations_user_id ON operations (user_id);

CREATE TABLE products (
    id SERIAL NOT NULL, 
    company_id INTEGER NOT NULL, 
    category_id INTEGER, 
    sku VARCHAR(40) NOT NULL, 
    name VARCHAR(150) NOT NULL, 
    unit_price NUMERIC(12, 2) NOT NULL, 
    unit_cost NUMERIC(12, 2) NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(category_id) REFERENCES categories (id) ON DELETE SET NULL, 
    FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
    CONSTRAINT uq_product_company_sku UNIQUE (company_id, sku)
);

CREATE INDEX ix_products_company_id ON products (company_id);

CREATE TABLE sales (
    id SERIAL NOT NULL, 
    branch_id INTEGER NOT NULL, 
    user_id INTEGER, 
    sale_date DATE NOT NULL, 
    customer VARCHAR(150), 
    total NUMERIC(14, 2) NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(branch_id) REFERENCES branches (id) ON DELETE CASCADE, 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_sales_branch_id ON sales (branch_id);

CREATE INDEX ix_sales_sale_date ON sales (sale_date);

CREATE TABLE vectors (
    id SERIAL NOT NULL, 
    company_id INTEGER, 
    name VARCHAR(150) NOT NULL, 
    description TEXT, 
    dimension INTEGER NOT NULL, 
    labels JSON, 
    source VARCHAR(40) NOT NULL, 
    created_by INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
    FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_vectors_company_id ON vectors (company_id);

CREATE TABLE inventory (
    id SERIAL NOT NULL, 
    branch_id INTEGER NOT NULL, 
    product_id INTEGER NOT NULL, 
    stock INTEGER NOT NULL, 
    min_stock INTEGER NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(branch_id) REFERENCES branches (id) ON DELETE CASCADE, 
    FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE CASCADE, 
    CONSTRAINT uq_inventory_branch_product UNIQUE (branch_id, product_id)
);

CREATE INDEX ix_inventory_branch_id ON inventory (branch_id);

CREATE INDEX ix_inventory_product_id ON inventory (product_id);

CREATE TABLE inventory_movements (
    id SERIAL NOT NULL, 
    branch_id INTEGER NOT NULL, 
    product_id INTEGER NOT NULL, 
    movement_type VARCHAR(20) NOT NULL, 
    quantity INTEGER NOT NULL, 
    reason VARCHAR(255), 
    user_id INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(branch_id) REFERENCES branches (id) ON DELETE CASCADE, 
    FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE CASCADE, 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_inventory_movements_branch_id ON inventory_movements (branch_id);

CREATE INDEX ix_inventory_movements_created_at ON inventory_movements (created_at);

CREATE INDEX ix_inventory_movements_product_id ON inventory_movements (product_id);

CREATE TABLE matrix_values (
    id SERIAL NOT NULL, 
    matrix_id INTEGER NOT NULL, 
    row_index INTEGER NOT NULL, 
    col_index INTEGER NOT NULL, 
    value FLOAT NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(matrix_id) REFERENCES matrices (id) ON DELETE CASCADE, 
    CONSTRAINT uq_matrix_cell UNIQUE (matrix_id, row_index, col_index)
);

CREATE INDEX ix_matrix_values_matrix_id ON matrix_values (matrix_id);

CREATE TABLE operation_inputs (
    id SERIAL NOT NULL, 
    operation_id INTEGER NOT NULL, 
    position INTEGER NOT NULL, 
    operand_kind VARCHAR(10) NOT NULL, 
    label VARCHAR(150), 
    vector_id INTEGER, 
    matrix_id INTEGER, 
    values JSON NOT NULL, 
    shape JSON NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(matrix_id) REFERENCES matrices (id) ON DELETE SET NULL, 
    FOREIGN KEY(operation_id) REFERENCES operations (id) ON DELETE CASCADE, 
    FOREIGN KEY(vector_id) REFERENCES vectors (id) ON DELETE SET NULL
);

CREATE INDEX ix_operation_inputs_operation_id ON operation_inputs (operation_id);

CREATE TABLE operation_results (
    id SERIAL NOT NULL, 
    operation_id INTEGER NOT NULL, 
    result_kind VARCHAR(10) NOT NULL, 
    values JSON NOT NULL, 
    shape JSON NOT NULL, 
    interpretation TEXT, 
    labels JSON, 
    saved_vector_id INTEGER, 
    saved_matrix_id INTEGER, 
    PRIMARY KEY (id), 
    FOREIGN KEY(operation_id) REFERENCES operations (id) ON DELETE CASCADE, 
    FOREIGN KEY(saved_matrix_id) REFERENCES matrices (id) ON DELETE SET NULL, 
    FOREIGN KEY(saved_vector_id) REFERENCES vectors (id) ON DELETE SET NULL, 
    UNIQUE (operation_id)
);

CREATE TABLE sale_details (
    id SERIAL NOT NULL, 
    sale_id INTEGER NOT NULL, 
    product_id INTEGER NOT NULL, 
    quantity INTEGER NOT NULL, 
    unit_price NUMERIC(12, 2) NOT NULL, 
    subtotal NUMERIC(14, 2) NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE RESTRICT, 
    FOREIGN KEY(sale_id) REFERENCES sales (id) ON DELETE CASCADE
);

CREATE INDEX ix_sale_details_product_id ON sale_details (product_id);

CREATE INDEX ix_sale_details_sale_id ON sale_details (sale_id);

CREATE TABLE targets (
    id SERIAL NOT NULL, 
    branch_id INTEGER NOT NULL, 
    product_id INTEGER NOT NULL, 
    period VARCHAR(7) NOT NULL, 
    target_quantity INTEGER NOT NULL, 
    target_amount NUMERIC(14, 2) NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(branch_id) REFERENCES branches (id) ON DELETE CASCADE, 
    FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE CASCADE, 
    CONSTRAINT uq_target_branch_product_period UNIQUE (branch_id, product_id, period)
);

CREATE INDEX ix_targets_branch_id ON targets (branch_id);

CREATE INDEX ix_targets_period ON targets (period);

CREATE INDEX ix_targets_product_id ON targets (product_id);

CREATE TABLE vector_values (
    id SERIAL NOT NULL, 
    vector_id INTEGER NOT NULL, 
    position INTEGER NOT NULL, 
    value FLOAT NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(vector_id) REFERENCES vectors (id) ON DELETE CASCADE, 
    CONSTRAINT uq_vector_position UNIQUE (vector_id, position)
);

CREATE INDEX ix_vector_values_vector_id ON vector_values (vector_id);

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

-- Running upgrade 0001 -> 0002

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "sale_details" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "inventory" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "targets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "vectors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "vector_values" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "matrices" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "matrix_values" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "operations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "operation_inputs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "operation_results" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

UPDATE alembic_version SET version_num='0002' WHERE alembic_version.version_num = '0001';

COMMIT;

