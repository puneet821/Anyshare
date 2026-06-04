import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { Copy, Image as ImageIcon, Send, Link as LinkIcon, Check, LogOut } from 'lucide-react';

function App() {
  const [peerId, setPeerId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  const [clipboardText, setClipboardText] = useState('');
  const [clipboardImage, setClipboardImage] = useState(null);

  const peerRef = useRef(null);
  const connRef = useRef(null);

  // Initialize PeerJS
  const initializePeer = (id) => {
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    
    const peer = new Peer(id);
    
    peer.on('open', (id) => {
      setPeerId(id);
      setIsWaiting(true);
      setConnectionError('');
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      setConnectionError(err.message || 'Failed to connect. The ID might be in use.');
      setIsConnected(false);
      setIsWaiting(false);
      setIsConnecting(false);
    });

    peerRef.current = peer;
  };

  const setupConnection = (conn) => {
    connRef.current = conn;
    
    conn.on('open', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setIsWaiting(false);
      setConnectionError('');
    });

    conn.on('data', (data) => {
      if (data.type === 'text') {
        setClipboardText(data.content);
      } else if (data.type === 'image') {
        setClipboardImage(data.content);
      }
    });

    conn.on('close', () => {
      setIsConnected(false);
      setIsWaiting(true); // Go back to waiting if they disconnect
      connRef.current = null;
    });
  };

  const connectToPeer = () => {
    if (!targetId.trim()) return;
    const conn = peerRef.current.connect(targetId);
    setupConnection(conn);
  };

  const sendData = (type, content) => {
    if (connRef.current && isConnected) {
      connRef.current.send({ type, content });
    }
  };

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setClipboardText(newText);
    sendData('text', newText);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Image = event.target.result;
        setClipboardImage(base64Image);
        sendData('image', base64Image);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(clipboardText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const disconnect = () => {
    if (connRef.current) {
      connRef.current.close();
    }
    setIsConnected(false);
    setIsWaiting(false);
    if (peerRef.current) {
      peerRef.current.destroy();
    }
  };

  // Run on mount without preset ID so user can type their own or auto-generate
  useEffect(() => {
    // Generate a random ID initially if preferred, or leave blank to let user choose.
    // We'll leave it blank and let them host with a specific ID.
  }, []);

  const handleHost = (e) => {
    e.preventDefault();
    if (peerId.trim().length > 3) {
      initializePeer(peerId);
    } else {
      setConnectionError('ID must be at least 4 characters long.');
    }
  };

  const handleConnect = (e) => {
    e.preventDefault();
    if (!targetId.trim()) return;
    setIsConnecting(true);
    setConnectionError('');

    if (!peerRef.current || peerRef.current.disconnected) {
       const tempPeer = new Peer();
       tempPeer.on('open', () => {
         peerRef.current = tempPeer;
         connectToPeer();
       });
       tempPeer.on('error', (err) => {
          setConnectionError(err.message);
          setIsConnecting(false);
       });
    } else {
      connectToPeer();
    }
  };

  if (isConnected) {
    return (
      <div className="app-container">
        <div className="status-bar">
          <div className="status-indicator">
            <div className="status-dot"></div>
            <span>Connected</span>
          </div>
          <button onClick={disconnect} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', borderRadius: '8px', display: 'flex', gap: '0.25rem', alignItems: 'center', border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer' }}>
            <LogOut size={16} /> Disconnect
          </button>
        </div>

        <div className="form-group">
          <label>Text Clipboard</label>
          <textarea
            className="input-field textarea"
            value={clipboardText}
            onChange={handleTextChange}
            placeholder="Type or paste text here... It will instantly appear on your connected device."
          />
        </div>

        <div className="action-buttons">
          <button onClick={copyToClipboard} className="btn">
            {isCopied ? <Check size={20} /> : <Copy size={20} />}
            {isCopied ? 'Copied!' : 'Copy Text'}
          </button>
        </div>

        <div className={`image-preview-container ${clipboardImage ? 'has-image' : ''}`}>
          {clipboardImage ? (
            <img src={clipboardImage} alt="Clipboard" />
          ) : (
            <div className="empty-image-state">
              <ImageIcon size={40} opacity={0.5} />
              <p>No image pasted</p>
            </div>
          )}
          
          <div className="file-input-wrapper">
            <button className="btn btn-secondary">
              <ImageIcon size={20} /> Choose Image to Sync
            </button>
            <input type="file" accept="image/*" onChange={handleImageUpload} />
          </div>
        </div>
      </div>
    );
  }

  if (isWaiting && !isConnected) {
    return (
      <div className="app-container">
        <div className="header">
          <h1>Room Hosted!</h1>
          <p>Waiting for another device to connect...</p>
        </div>
        <div className="status-bar" style={{ justifyContent: 'center' }}>
          <div className="status-indicator">
            <div className="status-dot" style={{ animation: 'pulse 1.5s infinite', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }}></div>
            <span>Room ID: <strong>{peerId}</strong></span>
          </div>
        </div>
        <div className="form-group" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: '1rem', lineHeight: '1.5' }}>On your other device, go to this app and enter the exact Room ID to connect.</p>
        </div>
        <button onClick={disconnect} className="btn btn-secondary" style={{ width: '100%' }}>
          Cancel Hosting
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="header">
        <h1>AnyPaste</h1>
        <p>Real-time P2P clipboard sync</p>
      </div>

      {connectionError && (
        <div style={{ color: 'var(--error)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
          {connectionError}
        </div>
      )}

      <form onSubmit={handleHost} className="form-group">
        <label>Create a Room (Host)</label>
        <input
          type="text"
          className="input-field"
          value={peerId}
          onChange={(e) => setPeerId(e.target.value)}
          placeholder="e.g. my-secret-room"
        />
        <button type="submit" className="btn" style={{ marginTop: '0.5rem' }}>
          <LinkIcon size={20} /> Start Hosting
        </button>
      </form>

      <div className="divider">OR</div>

      <form onSubmit={handleConnect} className="form-group">
        <label>Connect to a Room</label>
        <input
          type="text"
          className="input-field"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="Enter the host's Room ID"
          disabled={isConnecting}
        />
        <button type="submit" className="btn btn-secondary" style={{ marginTop: '0.5rem' }} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : <><Send size={20} /> Connect</>}
        </button>
      </form>
    </div>
  );
}

export default App;
