const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/dc-garment-types',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Testing API endpoint: http://localhost:5000/api/dc-garment-types\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:\n');
    
    try {
      const json = JSON.parse(data);
      console.log('Success:', json.success);
      console.log('Message:', json.message);
      console.log('Total garment types:', json.data?.length || 0);
      
      if (json.data) {
        const others = json.data.find(g => g.garment_name.toLowerCase() === 'others');
        if (others) {
          console.log('\n✅ "Others" found in API response!');
          console.log('Details:', others);
        } else {
          console.log('\n❌ "Others" NOT found in API response');
        }
        
        console.log('\nAll garment names:');
        json.data.forEach(g => console.log(`  - ${g.garment_name} (₱${g.garment_price})`));
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.end();
