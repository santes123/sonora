CREATE DATABASE IF NOT EXISTS music_test
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON music_test.* TO 'music'@'%';
FLUSH PRIVILEGES;
