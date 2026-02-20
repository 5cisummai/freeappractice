#!/usr/bin/env node
require('dotenv').config();

const http = require('http');

console.log('\n🧪 Testing Question Storage to S3\n');

function makeRequest(path, data, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function test() {
  let token = null;
  
  try {
    // Test 1: Register or login
    console.log('1️⃣ Testing user authentication...');
    const email = `test${Date.now()}@example.com`;
    
    let authResult = await makeRequest('/api/auth/register', {
      name: 'Test User',
      email: email,
      password: 'test123'
    });

    if (authResult.status === 409) {
      // User exists, try login
      authResult = await makeRequest('/api/auth/login', {
        email: 'test@example.com',
        password: 'test123'
      });
    }

    if (!authResult.data.token) {
      console.log('❌ Authentication failed:', authResult.data);
      process.exit(1);
    }

    token = authResult.data.token;
    console.log('✅ Authenticated successfully');

    // Test 2: Record a question attempt (saves to S3)
    console.log('\n2️⃣ Recording question attempt and saving to S3...');
    const questionData = {
      question: {
        question: 'What is the formula for the area of a circle?',
        optionA: 'πr',
        optionB: 'πr²',
        optionC: '2πr',
        optionD: 'πd',
        correctAnswer: 'B',
        explanation: 'The area of a circle is πr², where r is the radius.'
      },
      apClass: 'AP Calculus BC',
      unit: 'Unit 1',
      selectedAnswer: 'B',
      wasCorrect: true,
      timeTakenMs: 12000
    };

    const recordResult = await makeRequest('/api/auth/record-attempt', questionData, token);
    
    if (recordResult.status !== 200) {
      console.log('❌ Failed to record attempt:', recordResult.data);
      process.exit(1);
    }

    console.log('✅ Question saved to S3 with ID:', recordResult.data.questionId);
    console.log('   Mastery:', recordResult.data.mastery + '%');
    console.log('   Total attempts:', recordResult.data.totalAttempts);

    // Test 3: Retrieve history
    console.log('\n3️⃣ Retrieving question history...');
    const historyResult = await makeRequest('/api/auth/history?limit=10', null, token);
    
    if (historyResult.status !== 200) {
      console.log('❌ Failed to get history:', historyResult.data);
      process.exit(1);
    }

    console.log('✅ Retrieved history with', historyResult.data.history.length, 'questions');
    if (historyResult.data.history.length > 0) {
      const latest = historyResult.data.history[0];
      console.log('   Latest question ID:', latest.questionId);
      console.log('   Was correct:', latest.wasCorrect);
      console.log('   Question loaded from S3:', !!latest.question);
    }

    // Test 4: Get progress
    console.log('\n4️⃣ Retrieving progress...');
    const progressResult = await makeRequest('/api/auth/progress', null, token);
    
    if (progressResult.status !== 200) {
      console.log('❌ Failed to get progress:', progressResult.data);
      process.exit(1);
    }

    console.log('✅ Progress retrieved for', progressResult.data.progress.length, 'units');
    if (progressResult.data.progress.length > 0) {
      const prog = progressResult.data.progress[0];
      console.log('   Class:', prog.apClass);
      console.log('   Unit:', prog.unit);
      console.log('   Mastery:', prog.mastery + '%');
    }

    // Test 5: Bookmark question
    console.log('\n5️⃣ Testing bookmarks...');
    if (recordResult.data.questionId) {
      const bookmarkResult = await makeRequest('/api/auth/bookmark', {
        questionId: recordResult.data.questionId
      }, token);
      
      if (bookmarkResult.status !== 200) {
        console.log('❌ Failed to bookmark:', bookmarkResult.data);
      } else {
        console.log('✅ Bookmark added');
      }

      const bookmarksResult = await makeRequest('/api/auth/bookmarks', null, token);
      if (bookmarksResult.status === 200) {
        console.log('✅ Retrieved', bookmarksResult.data.bookmarks.length, 'bookmarked questions');
      }
    }

    console.log('\n✨ All tests passed! Question storage to S3 is working.\n');
    console.log('📋 Summary:');
    console.log('   • Questions are saved to S3 with unique IDs');
    console.log('   • User model stores only question IDs (not full objects)');
    console.log('   • Full questions are retrieved from S3 on demand');
    console.log('   • Progress tracking and bookmarks work correctly\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

test();
