import { useState, useEffect } from 'react'
import { ID, Query,} from 'appwrite' 
import { databases, account } from './appwriteConfig' 
import { s3Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from './r2Config';
import { PutObjectCommand } from "@aws-sdk/client-s3"
import imageCompression from 'browser-image-compression'
import { format } from 'timeago.js';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import Auth from './Auth'; // लॉगिन पेज


function App() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [caption, setCaption] = useState("")
  const [position, setPosition] = useState([28.6139, 77.2090]); 
  const [searchLocationName, setSearchLocationName] = useState("");
  const [topTravelers, setTopTravelers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(""); // जैसे '2024-03-22'
  const [activeTab, setActiveTab] = useState('memories'); // 'memories' या 'explore'
  const [selectedLocation, setSelectedLocation] = useState(""); // किसी खास जगह को चुनने के लिए
  const [menuPostId, setMenuPostId] = useState(null); // किस पोस्ट का मेनू खुला है
  const menuItemStyle = {width: '100%', padding: '10px 15px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', transition: '0.2s', color: '#262626'};
  const [editingPost, setEditingPost] = useState(null); // जो पोस्ट एडिट हो रही है उसका डेटा
  const [editCaption, setEditCaption] = useState("");


// 1. लॉगिन चेक करने के लिए
  useEffect(() => {
    const checkUser = async () => {
      try {
        const session = await account.get();
        setUser(session);
      } catch (err) {
        setUser(null);
        setPosts([]); // लॉगआउट होने पर पुरानी पोस्ट साफ़ करें
      }
    };
    checkUser();
  }, []);

  // 2. जब यूजर बदले, तो उसकी पोस्ट्स लाओ
  useEffect(() => {
    if (user) {
      fetchPosts();
    }
  }, [user]); // <--- यह लाइन नया अकाउंट लॉगिन होते ही डेटा रिफ्रेश करेगी

  // 3. टॉप ट्रैवलर्स काउंट करने के लिए
  useEffect(() => {
    if (posts.length > 0) {
      const counts = {};
      posts.forEach(post => {
        if (post.userName) {
          counts[post.userName] = (counts[post.userName] || 0) + 1;
        }
      });

      const sorted = Object.keys(counts)
        .map(name => ({ name, count: counts[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      setTopTravelers(sorted);
    }
  }, [posts]); // <--- पोस्ट्स बदलते ही रैंकिंग अपडेट होगी

  // जब भी टैब (Memories/Explore) या तारीख (selectedDate) बदले, तब पोस्ट्स मंगाएं
useEffect(() => {
  if (user) {
    fetchPosts();
  }
}, [activeTab, selectedDate, selectedLocation, user]); // ये तीनों चीज़ें यहाँ होनी चाहिए
// Post menu bar closed when click outsid screen
useEffect(() => {
  const closeMenu = () => setMenuPostId(null);
  if (menuPostId) {
    window.addEventListener('click', closeMenu);
  }
  return () => window.removeEventListener('click', closeMenu);
}, [menuPostId]);

const fetchPosts = async () => {
  try {
    let queries = [Query.orderDesc('createdAt')];

    // --- 1. अगर 'Saved' टैब खुला है ---
    if (activeTab === 'saved') {
      // पहले अपनी सेव की हुई IDs लाओ
      const savedRes = await databases.listDocuments(
        '69b02e2b000104b80a0e', 
        'saved_posts', 
        [Query.equal('userId', user.$id)]
      );
      
      const savedIds = savedRes.documents.map(d => d.postId);

      if (savedIds.length === 0) {
        setPosts([]); // अगर कुछ सेव नहीं है तो खाली लिस्ट
        return;
      }

      // अब सिर्फ वो पोस्ट्स लाओ जिनकी ID लिस्ट में है
      queries.push(Query.equal('$id', savedIds));
    } 

    // --- 2. अगर 'My Memories' टैब खुला है ---
    else if (activeTab === 'memories') {
      queries.push(Query.equal('userName', user.name));
    }

    // --- 3. लोकेशन फ़िल्टर (अगर चुना गया है) ---
    if (selectedLocation) {
      queries.push(Query.equal('locationName', selectedLocation));
    }

    // --- 4. डेट फ़िल्टर (अगर चुना गया है) ---
    if (selectedDate) {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      queries.push(Query.greaterThanEqual('createdAt', start.toISOString()));
      queries.push(Query.lessThanEqual('createdAt', end.toISOString()));
    }

    const res = await databases.listDocuments('69b02e2b000104b80a0e', 'posts', queries);
    setPosts(res.documents);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
};
  const handleSearch = async (e) => {
    if (!e.target.value) return;
    const provider = new OpenStreetMapProvider();
    const results = await provider.search({ query: e.target.value });
    if (results.length > 0) {
      const { x, y, label } = results[0];
      setPosition([y, x]);
      setSearchLocationName(label);
    }
  };
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center]);
  return null;
}
  function LocationMarker() {
    useMapEvents({
      click(e) { setPosition([e.latlng.lat, e.latlng.lng]); },
    });
    return <Marker position={position} />;
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
      const arrayBuffer = await compressedFile.arrayBuffer();
      const uploadData = new Uint8Array(arrayBuffer);
      const fileName = `post_${Date.now()}.png`;
      await s3Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME, Key: fileName, Body: uploadData, ContentType: "image/png"
      }));
      const finalR2Url = `${R2_PUBLIC_URL}/${fileName}`;

      await databases.createDocument('69b02e2b000104b80a0e', 'posts', ID.unique(), {
        imageUrl: finalR2Url,
        caption: caption,
        locationName: searchLocationName,
        lat: position[0].toString(),
        lng: position[1].toString(),
        createdAt: new Date().toISOString(),
        userName: user.name // लॉगिन यूजर का नाम
      });
      setCaption("");
      fetchPosts();
    } catch (err) { alert(err.message); }
    setLoading(false);
  };
  const handleLike = async (post) => {
  try {
    // 1. अगर पोस्ट में 'likes' एरे नहीं है, तो खाली एरे लें
    const currentLikes = post.likes || [];
    const userIndex = currentLikes.indexOf(user.$id);
    let updatedLikes = [...currentLikes];

    // 2. अगर यूजर ने पहले लाइक किया है तो हटाओ (Unlike), नहीं तो जोड़ो (Like)
    if (userIndex > -1) {
      updatedLikes.splice(userIndex, 1);
    } else {
      updatedLikes.push(user.$id);
    }

    // 3. Appwrite डेटाबेस अपडेट करें
    await databases.updateDocument(
      '69b02e2b000104b80a0e', 
      'posts', 
      post.$id, 
      { likes: updatedLikes }
    );
    
    // 4. फीड रिफ्रेश करें
    fetchPosts();
  } catch (err) {
    console.error("Like error:", err);
  }
};

const handleDelete = async (postId) => {
  if (window.confirm("Are you sure you want to delete this post?")) {
    try {
      await databases.deleteDocument(
        '69b02e2b000104b80a0e', 
        'posts', 
        postId
      );
      // डिलीट होने के बाद लिस्ट को रिफ्रेश करें
      fetchPosts(); 
      alert("पोस्ट डिलीट कर दी गई है।");
    } catch (err) {
      console.error("Delete failed:", err);
      alert("डिलीट करने में एरर आया।");
    }
  }
};

const handleUpdate = async () => {
  try {
    await databases.updateDocument(
      '69b02e2b000104b80a0e', 
      'posts', 
      editingPost.$id, 
      { caption: editCaption }
    );
    setEditingPost(null); // मॉडल बंद करें
    fetchPosts(); // लिस्ट रिफ्रेश करें
    alert("Memory updated successfully! ✨");
  } catch (err) {
    console.error(err);
    alert("Failed to update post.");
  }
};

const handleSave = async (postId) => {
  try {
    // पहले चेक करें कि क्या ये पहले से सेव तो नहीं है?
    const existing = await databases.listDocuments(
      '69b02e2b000104b80a0e', 
      'saved_posts', 
      [Query.equal('userId', user.$id), Query.equal('postId', postId)]
    );

    if (existing.documents.length > 0) {
      alert("You have already saved this post! 🔖");
      return;
    }

    // नया डॉक्यूमेंट बनाएं
    await databases.createDocument(
      '69b02e2b000104b80a0e', 
      'saved_posts', 
      'unique()', 
      {
        userId: user.$id,
        postId: postId
      }
    );
    alert("Post saved to your collection! 🔖");
  } catch (err) {
    console.error("Save Error:", err);
    alert("Failed to save post.");
  }
};

  // अगर लॉगिन नहीं है तो Login Page दिखाओ
if (!user) return <Auth onLogin={() => window.location.reload()} />;

  return (
    <div style={{ backgroundColor: '#fafafa', minHeight: '100vh', fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* --- Main Dashboard Layout --- */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', padding: '30px 10px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* 1. LEFT SIDEBAR */}
        <div style={{ width: '250px', position: 'sticky', top: '20px', height: 'fit-content' }}>
          <h2 style={{ marginBottom: '30px', color: '#262626' }}>TravelBook</h2>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '18px', lineHeight: '2.5' }}>
            <li 
              style={{ cursor: 'pointer', fontWeight: activeTab === 'memories' ? 'bold' : 'normal', color: activeTab === 'memories' ? '#0095f6' : '#262626' }}
              onClick={() => setActiveTab('memories')}
            >🏠 Home</li>
            
            <li 
              style={{ 
                cursor: 'pointer', 
                color: activeTab === 'saved' ? '#0095f6' : '#262626', 
                fontWeight: activeTab === 'saved' ? 'bold' : 'normal',
                display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px'
              }}
              onClick={() => {
                setActiveTab('saved');
                setSelectedLocation("");
                setSelectedDate("");
              }}
            >
              <span style={{ fontSize: '20px' }}>🏷️</span> Saved Posts
            </li>

            <li style={{ cursor: 'pointer' }}>👥 Travelers</li>
            <li style={{ cursor: 'pointer' }}>👨‍👩‍👧‍👦 Groups</li>
            <li style={{ cursor: 'pointer' }}>❤️ Notifications</li>
            <li style={{ cursor: 'pointer', color: 'red', marginTop: '20px' }} onClick={() => { account.deleteSession('current'); setUser(null); }}>🚪 Logout</li>
          </ul>
        </div>

        {/* 2. CENTER COLUMN (Feed) */}
        <div style={{ flex: '1', maxWidth: '600px', minHeight: '80vh' }}>
          
          {/* Create Post Box */}
          <div style={{ backgroundColor: 'white', border: '1px solid #dbdbdb', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '15px' }}>Add your Memories</p>
            <textarea 
              placeholder="Write your experience about this place?" 
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              style={{ width: '100%', padding: '12px', border: '1px solid #efefef', borderRadius: '8px', marginBottom: '15px', resize: 'none' }}
            />
            
            <div style={{ marginBottom: '15px' }}>
              <input type="text" placeholder="🔍 Search place..." onBlur={handleSearch} style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #dbdbdb', borderRadius: '4px' }} />
              <div style={{ height: '180px', borderRadius: '8px', overflow: 'hidden' }}>
                <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <ChangeView center={position} />
                  <LocationMarker />
                </MapContainer>
              </div>
              {searchLocationName && <p style={{ fontSize: '12px', color: '#0095f6', marginTop: '5px' }}>📍 {searchLocationName}</p>}
            </div>

            <label style={{ backgroundColor: '#0095f6', color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'block', textAlign: 'center', fontWeight: 'bold' }}>
              {loading ? "Posting..." : "Share Post"}
              <input type="file" onChange={handleUpload} style={{ display: 'none' }} disabled={loading} />
            </label>
          </div>

          {/* Tab Switcher */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '15px' }}>
            <button onClick={() => setActiveTab('memories')} style={{ padding: '12px 24px', borderRadius: '25px', border: 'none', backgroundColor: activeTab === 'memories' ? '#0095f6' : '#efefef', color: activeTab === 'memories' ? 'white' : '#262626', fontWeight: 'bold', cursor: 'pointer' }}>📸 Memories</button>
            <button onClick={() => setActiveTab('explore')} style={{ padding: '12px 24px', borderRadius: '25px', border: 'none', backgroundColor: activeTab === 'explore' ? '#0095f6' : '#efefef', color: activeTab === 'explore' ? 'white' : '#262626', fontWeight: 'bold', cursor: 'pointer' }}>🌎 Explore</button>
          </div>

          {/* Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px', padding: '10px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #dbdbdb' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>📅 Filter Date:</span>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ padding: '5px', borderRadius: '5px', border: '1px solid #ddd' }} />
            {selectedDate && <button onClick={() => setSelectedDate("")} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>Clear</button>}
          </div>

          {/* Saved Memory Header */}
          {activeTab === 'saved' && (
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #0095f6', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🔖</span>
              <h3 style={{ margin: 0, color: '#0095f6' }}>Your Saved Memories</h3>
            </div>
          )}

          {/* --- Feed List --- */}
          {posts.length > 0 ? (
            posts.map((post, index) => (
              <div key={post.$id} style={{ backgroundColor: 'white', border: '1px solid #dbdbdb', borderRadius: '12px', marginBottom: '25px', overflow: 'hidden' }}>
                <div style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#dbdbdb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'white', fontWeight: 'bold', flexShrink: 0, marginRight: '15px' }}>
                      {post.userName ? post.userName[0].toUpperCase() : 'U'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '15px', color: '#262626', lineHeight: '1.4' }}>
                        {post.userName || "User"}
                        {activeTab === 'memories' && <span style={{ color: '#8e8e8e', fontWeight: 'normal', fontSize: '12px', marginLeft: '5px' }}>• Memory #{posts.length - index}</span>}
                      </p>
                      {post.locationName && <p style={{ margin: 0, fontSize: '13px', color: '#0095f6', fontWeight: '500' }}>📍 {post.locationName}</p>}
                      <small style={{ color: '#8e8e8e', fontSize: '11px', marginTop: '2px' }}>{post.createdAt ? format(new Date(post.createdAt), 'PP') : "Just now"}</small>
                    </div>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button onClick={(e) => { e.stopPropagation(); setMenuPostId(menuPostId === post.$id ? null : post.$id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#8e8e8e', fontWeight: 'bold' }}>⋮</button>
                    {menuPostId === post.$id && (
                      <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '35px', backgroundColor: 'white', border: '1px solid #dbdbdb', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1000, width: '180px', overflow: 'hidden' }}>
                        <button style={menuItemStyle} onClick={() => { setEditingPost(post); setEditCaption(post.caption); setMenuPostId(null); }}>✏️ Edit Post</button>
                        <button style={menuItemStyle} onClick={() => { handleSave(post.$id); setMenuPostId(null); }}>🔖 Save Post</button>
                        {activeTab === 'memories' && (
                          <button style={{ ...menuItemStyle, color: '#ff4d4d', borderTop: '1px solid #efefef' }} onClick={() => { handleDelete(post.$id); setMenuPostId(null); }}>🗑️ Delete Post</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <img src={post.imageUrl} alt="post" style={{ width: '100%', display: 'block' }} />
                <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button onClick={() => handleLike(post)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: post.likes?.includes(user.$id) ? '#ed4956' : '#262626' }}>
                    {post.likes?.includes(user.$id) ? '❤️' : '🤍'}
                  </button>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{post.likes?.length || 0} Likes</span>
                </div>
                <div style={{ padding: '0 15px 15px 15px' }}>
                  <p style={{ margin: 0 }}><span style={{ fontWeight: 'bold', marginRight: '5px' }}>{post.userName || "User"}</span> {post.caption}</p>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '50px 20px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #dbdbdb', marginTop: '20px' }}>
              <div style={{ fontSize: '50px', marginBottom: '10px' }}>🔖</div>
              <h3 style={{ color: '#262626' }}>No Posts Found</h3>
              <p style={{ color: '#8e8e8e' }}>Go to Explore to find more memories!</p>
              <button onClick={() => setActiveTab('explore')} style={{ marginTop: '15px', padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0095f6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Go to Explore</button>
            </div>
          )}
        </div>

        {/* 3. RIGHT SIDEBAR */}
        <div style={{ width: '300px', position: 'sticky', top: '20px', height: 'fit-content' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #dbdbdb', borderRadius: '12px', padding: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ fontWeight: 'bold', color: '#262626', marginBottom: '20px', fontSize: '18px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📍 Visited Places</p>
            {/* Sidebar content logic... */}
          </div>
        </div>

      </div> {/* Main Layout End */}
    </div> // Background End
  );
}

export default App;