import React, { useState } from 'react';
import { account, ID } from './appwriteConfig'; // सुनिश्चित करें कि appwriteConfig में account एक्सपोर्ट है

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true); // लॉगिन और साइनअप के बीच स्विच करने के लिए
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        // 1. लॉगिन प्रक्रिया
        await account.createEmailPasswordSession(email, password);
      } else {
        // 2. साइनअप प्रक्रिया
        await account.create(ID.unique(), email, password, name);
        await account.createEmailPasswordSession(email, password);
      }
      onLogin(); // लॉगिन सफल होने पर App.jsx को सूचित करें
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#fafafa' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', border: '1px solid #dbdbdb', borderRadius: '8px', width: '350px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Arial', fontSize: '32px', marginBottom: '30px', fontWeight: 'bold' }}>TravelBook</h1>
        
        {error && <p style={{ color: 'red', fontSize: '13px', marginBottom: '15px' }}>{error}</p>}
        
        <form onSubmit={handleAuth}>
          {!isLogin && (
            <input 
              type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required 
              style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #efefef', borderRadius: '4px', backgroundColor: '#fafafa', boxSizing: 'border-box' }} 
            />
          )}
          <input 
            type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required 
            style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #efefef', borderRadius: '4px', backgroundColor: '#fafafa', boxSizing: 'border-box' }} 
          />
          <input 
            type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required 
            style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #efefef', borderRadius: '4px', backgroundColor: '#fafafa', boxSizing: 'border-box' }} 
          />
          
          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '10px', backgroundColor: '#0095f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div style={{ marginTop: '25px', borderTop: '1px solid #dbdbdb', paddingTop: '20px' }}>
          <p style={{ fontSize: '14px', color: '#8e8e8e' }}>
            {isLogin ? "Don't have an account?" : "Have an account?"} 
            <span 
              onClick={() => setIsLogin(!isLogin)} 
              style={{ color: '#0095f6', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' }}
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Auth;