import React, { useState } from 'react';
import { loginUser } from '../services/supabase';
import { Code2, KeyRound, User, AlertCircle } from 'lucide-react';
import styles from './Auth.module.css';

export const Auth: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validations
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await loginUser(username, password);
      // Note: App.tsx has an Auth listener, so it will update state automatically
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={`${styles.authCard} animate-fade-in`}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>
            <Code2 size={20} />
          </div>
          <span className={styles.logoText}>DevEval Pro</span>
        </div>

        <h2 className={styles.title}>Sign In</h2>
        <p className={styles.subtitle}>
          Welcome back! Enter your credentials to continue.
        </p>

        {error && (
          <div className="alert-danger" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username-input">Username / Email</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
              <input
                id="username-input"
                type="text"
                className="input-text"
                style={{ width: '100%', paddingLeft: '38px' }}
                placeholder="Enter your username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
              <input
                id="password-input"
                type="password"
                className="input-text"
                style={{ width: '100%', paddingLeft: '38px' }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '12px', padding: '12px' }}
            disabled={loading}
          >
            {loading ? (
              <span className="spin" style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTopColor: '#fff', borderRadius: '50%' }} />
            ) : (
              <>
                <KeyRound size={16} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
export default Auth;
