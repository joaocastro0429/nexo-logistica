CREATE TABLE IF NOT EXISTS empresas (
  id VARCHAR(64) PRIMARY KEY, nome VARCHAR(150) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  nome VARCHAR(150) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, senha_hash VARCHAR(256) NOT NULL,
  perfil ENUM('Administrador','Gestor','Operador') NOT NULL,
  session_version INT NOT NULL DEFAULT 0,
  INDEX (tenant_id), FOREIGN KEY (tenant_id) REFERENCES empresas(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS paineis (
  tenant_id VARCHAR(64) PRIMARY KEY, resumo LONGTEXT NOT NULL, eficiencia LONGTEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES empresas(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS rotas (
  id VARCHAR(64) NOT NULL, tenant_id VARCHAR(64) NOT NULL, nome VARCHAR(150) NOT NULL,
  pedidos INT NOT NULL, previsao VARCHAR(20) NOT NULL, status VARCHAR(30) NOT NULL,
  PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id) REFERENCES empresas(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS clientes (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL, nome VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL, telefone VARCHAR(30) NOT NULL, documento VARCHAR(30) NOT NULL,
  INDEX (tenant_id), FOREIGN KEY (tenant_id) REFERENCES empresas(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS transportadoras (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL, nome VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL, telefone VARCHAR(30) NOT NULL,
  taxa_base DECIMAL(16,4) NOT NULL, valor_kg DECIMAL(16,4) NOT NULL, valor_km DECIMAL(16,4) NOT NULL,
  INDEX (tenant_id), FOREIGN KEY (tenant_id) REFERENCES empresas(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS simulacoes (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL,
  criada_em VARCHAR(30) NOT NULL, dados LONGTEXT NOT NULL,
  INDEX (tenant_id, criada_em), FOREIGN KEY (tenant_id) REFERENCES empresas(id)
) ENGINE=InnoDB;
