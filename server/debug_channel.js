// debug_channel.js - Standalone debug script (Updated with Bearer Token)
// Usage: node debug_channel.js [channelId]
// Example: node debug_channel.js 1382478

const { spawn } = require("child_process");

const CHANNEL_ID = process.argv[2] || "71431";
const COOKIE = "mac=00%3A1A%3A79%3A9C%3A5F%3AD5; stb_lang=en; timezone=Africa%2FNairobi; adid=13390b63b1ae7032187e40a96e160ee4";

async function debugChannel() {
  console.log(`🔍 Debugging channel ${CHANNEL_ID}\n`);
  console.log(`🌍 Testing for: Geo-blocking, Auth issues, Port/Protocol mismatches\n`);
  
  let apiStreamUrl = null;
  let correctedUrl = null;
  let playToken = null;
  let bearerToken = null;
  
  // Test 1: Get stream URL from API
  console.log("📡 STEP 1: Getting stream URL and tokens from API...");
  
  try {
    console.log("   Requesting handshake...");
    const tokenRes = await fetch(
      `http://expat-tv.xyz/portalott.php?type=stb&action=handshake&token=&prehash=9c42ac937c6bc42ba21b45b853bfc020b013f8f6&JsHttpRequest=1-xml`,
      {
        headers: {
          Cookie: COOKIE,
          "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C)",
        },
      }
    );
    
    console.log(`   Handshake status: ${tokenRes.status} ${tokenRes.statusText}`);
    
    const tokenData = await tokenRes.json();
    bearerToken = tokenData?.js?.token;
    
    if (!bearerToken) {
      console.log("❌ Failed to get token - Authentication issue!");
      console.log("   Response:", JSON.stringify(tokenData).substring(0, 200));
    } else {
      console.log("✅ Bearer Token received successfully");
      console.log(`   Token: ${bearerToken.substring(0, 20)}...`);
      
      // Get stream link
      const cmd = `ffmpeg http://expat-tv.xyz:80/MAGL2ELNMB/MAG42M41CA/${CHANNEL_ID}`;
      
      console.log("   Requesting stream link...");
      const linkRes = await fetch(
        `http://expat-tv.xyz/portalott.php?type=itv&action=create_link&cmd=${encodeURIComponent(cmd)}&JsHttpRequest=1-xml`,
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            Cookie: COOKIE,
            Referer: "http://expat-tv.xyz/c/",
            "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C)",
            "X-User-Agent": "Model: MAG250; Link: WiFi",
          },
        }
      );
      
      console.log(`   Link status: ${linkRes.status} ${linkRes.statusText}`);
      
      const text = await linkRes.text();
      
      if (!text || text.trim() === '') {
        console.log("   ⚠️ Empty response from create_link");
      } else {
        console.log(`   Response (first 200 chars): ${text.substring(0, 200)}`);
      }
      
      let linkData;
      try {
        linkData = JSON.parse(text);
        apiStreamUrl = linkData?.js?.cmd;
      } catch (e) {
        console.log("❌ Invalid JSON response");
        console.log(`   Full response: ${text}`);
      }
      
      if (apiStreamUrl) {
        console.log(`🔍 Raw API URL: ${apiStreamUrl}`);
        
        // Check for malformed URL and fix it
        if (apiStreamUrl.includes('tv.xyz:80/MAGL2ELNMB/MAG42M41CA/tv.xyz')) {
          console.warn(`⚠️ MALFORMED URL DETECTED - Contains duplicated path`);
          
          // Extract play_token
          const tokenMatch = text.match(/play_token=([^&\s"\\]+)/);
          if (tokenMatch) {
            playToken = tokenMatch[1];
            console.log(`   Found play_token: ${playToken}`);
          }
          
          // Extract channel ID
          const idMatch = apiStreamUrl.match(/\/MAGL2ELNMB\/MAG42M41CA\/(\d+)/);
          if (idMatch) {
            const realId = idMatch[1];
            correctedUrl = `http://expat-tv.xyz:80/MAGL2ELNMB/MAG42M41CA/${realId}`;
            if (playToken) {
              correctedUrl += `?play_token=${playToken}`;
            }
            console.log(`✅ CORRECTED URL: ${correctedUrl}`);
          }
        }
      } else {
        console.log("❌ No stream URL returned from API");
      }
    }
  } catch (err) {
    console.error(`❌ API Error: ${err.message}`);
  }
  
  // Test 2: Try different URL patterns with different auth methods
  console.log("\n📡 STEP 2: Testing URL accessibility with different auth methods...");
  
  const urls = [];
  
  // Add corrected URL first if available
  if (correctedUrl) {
    urls.push({ 
      label: "✅ CORRECTED API URL (Cookie only)", 
      url: correctedUrl,
      useBearer: false 
    });
    urls.push({ 
      label: "✅ CORRECTED API URL (Cookie + Bearer)", 
      url: correctedUrl,
      useBearer: true 
    });
    if (playToken) {
      urls.push({ 
        label: "✅ CORRECTED API URL (Bearer only, no Cookie)", 
        url: correctedUrl,
        useBearer: true,
        useCookie: false 
      });
    }
  }
  
  // Add raw API URL for comparison
  if (apiStreamUrl && apiStreamUrl !== correctedUrl) {
    urls.push({ 
      label: "❌ RAW API URL (malformed)", 
      url: apiStreamUrl,
      useBearer: true 
    });
  }
  
  // Add fallback URLs with different auth combinations
  urls.push(
    { label: "Fallback HTTP (Cookie only)", url: `http://expat-tv.xyz/MAGL2ELNMB/MAG42M41CA/${CHANNEL_ID}`, useBearer: false },
    { label: "Fallback HTTP (Cookie + Bearer)", url: `http://expat-tv.xyz/MAGL2ELNMB/MAG42M41CA/${CHANNEL_ID}`, useBearer: true },
    { label: "Port 80 (Cookie only)", url: `http://expat-tv.xyz:80/MAGL2ELNMB/MAG42M41CA/${CHANNEL_ID}`, useBearer: false },
    { label: "Port 80 (Cookie + Bearer)", url: `http://expat-tv.xyz:80/MAGL2ELNMB/MAG42M41CA/${CHANNEL_ID}`, useBearer: true },
  );
  
  // Add play_token variations if available
  if (playToken) {
    urls.push(
      { label: "Port 80 + play_token (Cookie only)", url: `http://expat-tv.xyz:80/MAGL2ELNMB/MAG42M41CA/${CHANNEL_ID}?play_token=${playToken}`, useBearer: false },
      { label: "Port 80 + play_token (Cookie + Bearer)", url: `http://expat-tv.xyz:80/MAGL2ELNMB/MAG42M41CA/${CHANNEL_ID}?play_token=${playToken}`, useBearer: true },
      { label: "Port 80 + play_token (Bearer only)", url: `http://expat-tv.xyz:80/MAGL2ELNMB/MAG42M41CA/${CHANNEL_ID}?play_token=${playToken}`, useBearer: true, useCookie: false },
    );
  }
  
  let workingUrl = null;
  let workingAuth = null;
  
  for (const test of urls) {
    if (!test.url) continue;
    
    console.log(`\n🔗 Testing: ${test.label}`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Auth: ${test.useBearer ? 'Bearer Token' : 'None'}${test.useCookie !== false ? ' + Cookie' : ''}`);
    
    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C)",
        "X-User-Agent": "Model: MAG250; Link: WiFi",
        "Referer": "http://expat-tv.xyz/c/",
      };
      
      // Add Cookie if not explicitly disabled
      if (test.useCookie !== false) {
        headers["Cookie"] = COOKIE;
      }
      
      // Add Bearer token if this test requires it
      if (test.useBearer && bearerToken) {
        headers["Authorization"] = `Bearer ${bearerToken}`;
      }
      
      const res = await fetch(test.url, {
        method: 'GET',
        headers: headers,
        signal: AbortSignal.timeout(8000)
      });
      
      const contentType = res.headers.get('content-type') || '';
      console.log(`   Status: ${res.status} ${res.statusText}`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Content-Length: ${res.headers.get('content-length') || 'unknown'}`);
      
      if (res.ok) {
        if (contentType.includes('video') || contentType.includes('mpeg') || contentType.includes('octet-stream')) {
          console.log(`   ✅ SUCCESS - Valid stream detected!`);
          if (!workingUrl) {
            workingUrl = test.url;
            workingAuth = {
              useBearer: test.useBearer,
              useCookie: test.useCookie !== false,
              bearerToken: test.useBearer ? bearerToken : null,
              playToken: playToken
            };
          }
        } else {
          const body = await res.text();
          console.log(`   ⚠️ Unexpected content: ${body.substring(0, 100)}`);
        }
      } else if (res.status === 401) {
        console.log(`   🔒 UNAUTHORIZED - Auth required or invalid token`);
      } else if (res.status === 403) {
        console.log(`   🚫 FORBIDDEN - Possible geo-blocking`);
      } else if (res.status === 404) {
        console.log(`   📭 NOT FOUND - Channel might not exist`);
      } else {
        console.log(`   ❌ Failed with status ${res.status}`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      if (err.message.includes('timeout')) {
        console.log(`   ⏱️ TIMEOUT - Server not responding`);
      }
    }
  }
  
  // Test 3: ffprobe analysis on working URL
  console.log("\n📡 STEP 3: ffprobe analysis with best auth method...");
  
  if (workingUrl && workingAuth) {
    console.log(`Using URL: ${workingUrl}`);
    console.log(`Auth method: ${workingAuth.useBearer ? 'Bearer Token' : 'None'}${workingAuth.useCookie ? ' + Cookie' : ''}`);
    await testWithFFprobe(workingUrl, workingAuth, bearerToken, COOKIE);
  } else if (correctedUrl) {
    console.log(`No working URL found, trying corrected URL with all auth...`);
    console.log(`Using URL: ${correctedUrl}`);
    await testWithFFprobe(correctedUrl, { useBearer: true, useCookie: true }, bearerToken, COOKIE);
  } else {
    console.log("No URL available to test");
  }
  
  // Summary
  console.log("\n\n📊 DIAGNOSTIC SUMMARY:");
  console.log("=======================");
  
  if (correctedUrl) {
    console.log("✅ SERVER FIX ACTIVE: Malformed URL detected and corrected");
    console.log(`   Original: ${apiStreamUrl}`);
    console.log(`   Corrected: ${correctedUrl}`);
  }
  
  if (playToken) {
    console.log(`🎫 Play Token: ${playToken}`);
  }
  
  if (bearerToken) {
    console.log(`🔑 Bearer Token: ${bearerToken.substring(0, 20)}...`);
  }
  
  if (workingUrl) {
    console.log(`\n✅ WORKING CONFIGURATION FOUND:`);
    console.log(`   URL: ${workingUrl}`);
    console.log(`   Auth: ${workingAuth.useBearer ? 'Bearer Token' : 'None'}${workingAuth.useCookie ? ' + Cookie' : ''}`);
    if (workingAuth.playToken) {
      console.log(`   Play Token: ${workingAuth.playToken}`);
    }
  } else {
    console.log(`\n❌ NO WORKING CONFIGURATION FOUND`);
    console.log(`   All URLs returned 401 - This channel requires authentication`);
    console.log(`   Make sure your server passes BOTH Cookie AND Bearer token to ffmpeg`);
  }
  
  console.log("\n🔧 Required ffmpeg headers for this channel:");
  console.log(`   User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C)`);
  console.log(`   X-User-Agent: Model: MAG250; Link: WiFi`);
  console.log(`   Referer: http://expat-tv.xyz/c/`);
  console.log(`   Cookie: [YOUR_COOKIE]`);
  if (bearerToken) {
    console.log(`   Authorization: Bearer ${bearerToken.substring(0, 20)}...`);
  }
  
  console.log(`\n🌐 Test in browser: http://localhost:3477/debug/test-stream/${CHANNEL_ID}`);
}

function testWithFFprobe(url, authConfig, bearerToken, cookie) {
  return new Promise((resolve) => {
    console.log(`\n🔬 Running ffprobe on: ${url}`);
    
    const args = [
      "-v", "error",
      "-show_entries", "stream=codec_type,codec_name,width,height,duration",
      "-of", "default=noprint_wrappers=1",
      "-timeout", "10000000",
    ];
    
    // Build headers
    let headers = 
      `User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C)\r\n` +
      `X-User-Agent: Model: MAG250; Link: WiFi\r\n` +
      `Referer: http://expat-tv.xyz/c/\r\n`;
    
    if (authConfig.useCookie) {
      headers += `Cookie: ${cookie}\r\n`;
    }
    
    if (authConfig.useBearer && bearerToken) {
      headers += `Authorization: Bearer ${bearerToken}\r\n`;
    }
    
    args.push("-headers", headers);
    args.push(url);
    
    console.log(`   Auth: ${authConfig.useBearer ? 'Bearer' : 'None'}${authConfig.useCookie ? ' + Cookie' : ''}`);
    
    const ffprobe = spawn("ffprobe", args);
    
    let output = "";
    let errorOutput = "";
    
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
      process.stdout.write(data.toString());
    });
    
    ffprobe.stderr.on("data", (data) => {
      errorOutput += data.toString();
      process.stderr.write(data.toString());
    });
    
    setTimeout(() => {
      ffprobe.kill();
      console.log("\n⏱️ ffprobe timed out after 10 seconds");
      resolve();
    }, 10000);
    
    ffprobe.on("close", (code) => {
      if (code === 0 && output) {
        console.log("\n✅ Stream is valid! Codec info:");
        console.log(output);
      } else {
        console.log(`\n❌ ffprobe failed (exit code: ${code})`);
        if (errorOutput) {
          console.log(`Error: ${errorOutput.substring(0, 500)}`);
        }
      }
      resolve();
    });
  });
}

// Run the debug
console.log("🔧 IPTV Channel Debug Tool v3.0");
console.log("================================\n");
debugChannel().catch(console.error);