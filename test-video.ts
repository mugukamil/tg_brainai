import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const GOAPI_API_KEY = process.env.GOAPI_API_KEY;

async function testVideoGeneration() {
  console.log('=== TESTING VIDEO GENERATION ===');
  console.log('API Key present:', !!GOAPI_API_KEY);
  console.log(
    'API Key (first 10 chars):',
    GOAPI_API_KEY ? GOAPI_API_KEY.substring(0, 10) + '...' : 'NOT SET',
  );

  if (!GOAPI_API_KEY) {
    console.error('ERROR: GOAPI_API_KEY is not set in environment variables');
    return;
  }

  const goapi = axios.create({
    baseURL: 'https://api.goapi.ai/api/v1',
    headers: {
      'x-api-key': GOAPI_API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });

  // Test different version configurations
  const testConfigs = [
    // { version: '1.0', mode: 'std', prompt: 'A black ninja with a sword' },
    // { version: '1.5', mode: 'std', prompt: 'A ninja warrior' },
    { version: '1.6', mode: 'std', prompt: 'Ninja in action' },
    // { version: '2.0', mode: 'pro', prompt: 'Epic ninja scene' },
    { version: '2.1', mode: 'std', prompt: 'Epic ninja scene' },
    { version: undefined, mode: 'std', prompt: 'Simple ninja video' },
  ];

  for (const config of testConfigs) {
    console.log(
      `\n=== Testing with version: ${config.version || 'default'}, mode: ${config.mode} ===`,
    );

    const body = {
      model: 'kling',
      task_type: 'video_generation',
      input: {
        prompt: config.prompt,
        negative_prompt: '',
        cfg_scale: 0.5,
        duration: 5,
        aspect_ratio: '1:1',
        camera_control: {
          type: 'simple',
          config: {
            horizontal: 0,
            vertical: 0,
            pan: -10,
            tilt: 0,
            roll: 0,
            zoom: 0,
          },
        },
        mode: config.mode,
        ...(config.version && { version: config.version }),
      },
    };

    console.log('Request body:', JSON.stringify(body, null, 2));

    try {
      const response = await goapi.post('/task', body);
      console.log('✅ Success!');
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));

      // If successful, we found a working configuration
      console.log('\n🎉 WORKING CONFIGURATION FOUND:');
      console.log(`Version: ${config.version || 'not specified'}`);
      console.log(`Mode: ${config.mode}`);
      break;
    } catch (error) {
      console.error('❌ Failed');
      if (axios.isAxiosError(error)) {
        console.error('Status:', error.response?.status);
        console.error('Status text:', error.response?.statusText);
        console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Response headers:', error.response?.headers);
      } else {
        console.error('Error:', error);
      }
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Run the test
testVideoGeneration().catch(console.error);
