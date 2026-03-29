const db = require('./config/db');

console.log('Checking dry_cleaning_garment_types table...\n');

db.query('SELECT * FROM dry_cleaning_garment_types ORDER BY dc_garment_id', (err, results) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log(`Found ${results.length} garment types:\n`);
  results.forEach(row => {
    console.log(`ID: ${row.dc_garment_id} | Name: ${row.garment_name} | Price: ₱${row.garment_price} | Active: ${row.is_active}`);
  });
  
  const others = results.find(r => r.garment_name.toLowerCase() === 'others');
  if (others) {
    console.log('\n✅ "Others" garment type found!');
    console.log('Details:', others);
  } else {
    console.log('\n❌ "Others" garment type NOT found in database');
  }
  
  process.exit(0);
});
