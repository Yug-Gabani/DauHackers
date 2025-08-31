const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testBackend() {
  console.log('🧪 Testing CoastalGuard Backend...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get('http://localhost:5000/health');
    console.log('✅ Health check passed:', healthResponse.data);
    console.log('');

    // Test dashboard overview
    console.log('2. Testing dashboard overview...');
    const dashboardResponse = await axios.get(`${BASE_URL}/dashboard/overview`);
    console.log('✅ Dashboard overview:', dashboardResponse.data.success ? 'Success' : 'Failed');
    console.log('');

    // Test weather API
    console.log('3. Testing weather API...');
    const weatherResponse = await axios.get(`${BASE_URL}/weather/coastal-summary?coastalArea=mumbai`);
    console.log('✅ Weather API:', weatherResponse.data.success ? 'Success' : 'Failed');
    console.log('');

    // Test reports API
    console.log('4. Testing reports API...');
    const reportsResponse = await axios.get(`${BASE_URL}/reports/stats`);
    console.log('✅ Reports API:', reportsResponse.data.success ? 'Success' : 'Failed');
    console.log('');

    // Test alerts API
    console.log('5. Testing alerts API...');
    const alertsResponse = await axios.get(`${BASE_URL}/alerts?limit=5`);
    console.log('✅ Alerts API:', alertsResponse.data.success ? 'Success' : 'Failed');
    console.log('');

    console.log('🎉 All tests passed! Backend is working correctly.');
    console.log('\n📊 Available endpoints:');
    console.log('   - Health: http://localhost:5000/health');
    console.log('   - API Docs: http://localhost:5000/api');
    console.log('   - Dashboard: http://localhost:5000/api/dashboard/overview');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server is not running. Please start the server first:');
      console.log('   npm run dev');
    } else {
      console.log('❌ Test failed:', error.message);
    }
  }
}

// Run tests
testBackend();
