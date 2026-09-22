const { Client } = require('pg');

const connectionString = "postgres://postgres.stub:2jAm38abeNBLA27HbGeP@178.104.127.220:5432/postgres";

async function deploy() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query('SELECT 1');
    console.log(res.rows);
  } catch (err) {
    console.error('Error deploying to remote DB:', err);
  } finally {
    await client.end();
  }
}

deploy();
