/**
 * AuthGate — minimal session gate in front of the desktop.
 *
 * The backend protects /api/* with a session cookie. On boot we ask /api/me
 * whether we already have a valid session; if not, we render a login screen
 * and resolve only once the user authenticates.
 */

export interface CurrentUser {
    username: string;
}

/** Returns the logged-in user, or null if there is no valid session. */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
    try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (!res.ok) return null;
        return await res.json() as CurrentUser;
    } catch {
        return null;
    }
}

/** Attempts login. Resolves with the user on success, throws on failure. */
export async function login(username: string, password: string): Promise<CurrentUser> {
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
        let message = 'Login failed';
        if (res.status === 429) {
            message = 'Too many attempts. Try again later.';
        } else if (res.status === 401) {
            message = 'Invalid username or password';
        }
        throw new Error(message);
    }

    return await res.json() as CurrentUser;
}

/** Clears the server-side session. */
export async function logout(): Promise<void> {
    try {
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
        // Ignore network errors on logout; the reload that follows is enough.
    }
}

/**
 * Ensures an authenticated session before booting the desktop. If a session
 * already exists it resolves immediately; otherwise it renders the login
 * screen and resolves once the user signs in.
 */
export async function requireAuth(): Promise<CurrentUser> {
    const existing = await fetchCurrentUser();
    if (existing) {
        return existing;
    }
    return showLoginScreen();
}

function showLoginScreen(): Promise<CurrentUser> {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'login-overlay';
        overlay.innerHTML = `
            <form class="login-card" autocomplete="on">
                <h1 class="login-title">WebDesk OS</h1>
                <p class="login-subtitle">Sign in with your account</p>
                <label class="login-field">
                    <span>Username</span>
                    <input type="text" name="username" autocomplete="username" required autofocus />
                </label>
                <label class="login-field">
                    <span>Password</span>
                    <input type="password" name="password" autocomplete="current-password" required />
                </label>
                <div class="login-error" hidden></div>
                <button type="submit" class="login-submit">Sign in</button>
            </form>
        `;

        document.body.appendChild(overlay);

        const form = overlay.querySelector<HTMLFormElement>('.login-card')!;
        const errorEl = overlay.querySelector<HTMLElement>('.login-error')!;
        const submitBtn = overlay.querySelector<HTMLButtonElement>('.login-submit')!;
        const usernameInput = overlay.querySelector<HTMLInputElement>('input[name="username"]')!;
        const passwordInput = overlay.querySelector<HTMLInputElement>('input[name="password"]')!;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorEl.hidden = true;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in…';

            try {
                const user = await login(usernameInput.value, passwordInput.value);
                overlay.remove();
                resolve(user);
            } catch (err) {
                errorEl.textContent = err instanceof Error ? err.message : 'Login failed';
                errorEl.hidden = false;
                passwordInput.value = '';
                passwordInput.focus();
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign in';
            }
        });
    });
}
