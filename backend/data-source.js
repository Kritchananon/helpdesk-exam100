// data-source.js
const { DataSource } = require('typeorm');
require('dotenv').config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'thanya7746',
  database: process.env.DB_NAME || 'db_support_ticket',
  synchronize: false,
  logging: false,
  entities: ['dist/**/*.entity{.ts,.js}'], // ใช้ dist สำหรับ compiled files
  migrations: ['dist/migrations/*.js'],
})

module.exports = { AppDataSource };