const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function checkLogin() {
  console.log('Testing login with URL:', supabaseUrl);
  
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'fidel@dr-resources.com',
        password: 'fidel123'
      })
    });
    
    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Body:', data);
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  }
}

checkLogin();
