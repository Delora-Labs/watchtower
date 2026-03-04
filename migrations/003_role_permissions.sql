-- Step 1: First update existing values to be compatible
UPDATE users SET role = 'admin' WHERE role NOT IN ('admin', 'member', 'viewer');

-- Step 2: Add new roles as temporary column
ALTER TABLE users ADD COLUMN new_role VARCHAR(20) DEFAULT 'user';

-- Step 3: Migrate data
UPDATE users SET new_role = CASE 
    WHEN role = 'admin' THEN 'system_admin'
    WHEN role = 'member' THEN 'user'
    WHEN role = 'viewer' THEN 'user'
    ELSE 'user'
END;

-- Step 4: Drop old column and rename
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users CHANGE new_role role ENUM('system_admin', 'team_lead', 'user') DEFAULT 'user';

-- Update team_members role
ALTER TABLE team_members MODIFY COLUMN role ENUM('lead', 'member') DEFAULT 'member';

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(36) PRIMARY KEY,
    role VARCHAR(20) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    UNIQUE KEY uk_role_resource_action (role, resource, action)
);

-- Default permissions
INSERT IGNORE INTO permissions (id, role, resource, action) VALUES
(UUID(), 'system_admin', 'servers', 'manage'),
(UUID(), 'system_admin', 'apps', 'manage'),
(UUID(), 'system_admin', 'teams', 'manage'),
(UUID(), 'system_admin', 'users', 'manage'),
(UUID(), 'system_admin', 'settings', 'manage'),
(UUID(), 'team_lead', 'apps', 'read'),
(UUID(), 'team_lead', 'apps', 'restart'),
(UUID(), 'team_lead', 'team_members', 'manage'),
(UUID(), 'user', 'apps', 'read');
