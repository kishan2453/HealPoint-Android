const http = require('http');
const https = require('https');

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('=== HEALPOINT SYSTEM END-TO-END VERIFICATION ===\n');

  // 1. Local backend
  try {
    const localHealth = await request('http://localhost:8080/api/v1/health');
    console.log('1. Local Backend (http://localhost:8080/api/v1/health):', localHealth.status, localHealth.data);
  } catch (err) {
    console.log('1. Local Backend Error:', err.message);
  }

  // 2. Local Hospital Admin Portal
  try {
    const hospitalPortal = await request('http://localhost:5176');
    console.log('2. Hospital Admin Portal (http://localhost:5176): Status', hospitalPortal.status);
  } catch (err) {
    console.log('2. Hospital Admin Portal Error:', err.message);
  }

  // 3. Live Production Backend
  try {
    const liveHealth = await request('https://heal-point-backend.vercel.app/api/v1/health');
    console.log('3. Live Backend Health (https://heal-point-backend.vercel.app/api/v1/health):', liveHealth.status, liveHealth.data);
  } catch (err) {
    console.log('3. Live Backend Error:', err.message);
  }

  // 4. Live Doctor Portal
  try {
    const docPortal = await request('https://heal-point-doctor-web.vercel.app');
    console.log('4. Live Doctor Portal (https://heal-point-doctor-web.vercel.app): Status', docPortal.status, 'Body length:', typeof docPortal.data === 'string' ? docPortal.data.length : 'JSON');
  } catch (err) {
    console.log('4. Live Doctor Portal Error:', err.message);
  }

  // 5. Live Patient Portal
  try {
    const patientPortal = await request('https://heal-point-mauve.vercel.app');
    console.log('5. Live Patient Portal (https://heal-point-mauve.vercel.app): Status', patientPortal.status, 'Body length:', typeof patientPortal.data === 'string' ? patientPortal.data.length : 'JSON');
  } catch (err) {
    console.log('5. Live Patient Portal Error:', err.message);
  }

  // 6. Test Production Auth & Booking
  try {
    console.log('\n--- Testing Live Production Backend Booking API ---');
    const loginRes = await request('https://heal-point-backend.vercel.app/api/v1/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'abcd@gmail.com', password: 'password123' });

    if (!loginRes.data?.token) {
      console.log('Login failed on live backend:', loginRes.data);
      return;
    }

    const token = loginRes.data.token;
    console.log('✓ Successfully authenticated as user:', loginRes.data.user?.name || loginRes.data.user?.email);

    // Fetch doctors to find a valid doctorId
    const docRes = await request('https://heal-point-backend.vercel.app/api/v1/doctor/get-all', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const doctorList = docRes.data?.doctors || docRes.data?.data || (Array.isArray(docRes.data) ? docRes.data : []);
    const doctor = doctorList[0];
    if (!doctor) {
      console.log('No doctors found on live backend:', docRes.data);
      return;
    }
    console.log('✓ Target Doctor:', doctor.name, 'ID:', doctor._id);

    // Test A: Past Date Booking (Must be rejected with 400 PAST_DATE_NOT_ALLOWED)
    const pastBookingRes = await request('https://heal-point-backend.vercel.app/api/v1/appointment/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    }, {
      doctorId: doctor._id,
      slotDate: '01-01-2020',
      slotTime: '10:00 AM',
      consultationType: 'clinic',
      patientName: 'Automated Test Patient',
      patientAge: 30,
      patientGender: 'male',
      patientPhone: '9876543210'
    });
    console.log('Test A (Past Date Rejection): Status', pastBookingRes.status, 'Response:', pastBookingRes.data);

    // Test B: Valid Future Date Booking (Must NOT throw dateObj.getDate is not a function)
    const futureBookingRes = await request('https://heal-point-backend.vercel.app/api/v1/appointment/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    }, {
      doctorId: doctor._id,
      slotDate: '12-12-2026',
      slotTime: '11:00 AM',
      consultationType: 'clinic',
      patientName: 'Test Verification Probe',
      patientAge: 25,
      patientGender: 'male',
      patientPhone: '9876543210'
    });
    console.log('Test B (Future Date Booking): Status', futureBookingRes.status, 'Response:', futureBookingRes.data);

    if (futureBookingRes.data?.message && futureBookingRes.data.message.includes('getDate is not a function')) {
      console.error('❌ CRITICAL ERROR: dateObj.getDate is not a function STILL THROWN!');
    } else if (futureBookingRes.status === 200 || futureBookingRes.status === 201 || futureBookingRes.data?.success) {
      console.log('🎉 SUCCESS: Booking created without any dateObj exception!');
    } else {
      console.log('Booking returned:', futureBookingRes.status, futureBookingRes.data?.message);
    }
  } catch (err) {
    console.error('Auth/Booking test error:', err);
  }
}

run();
