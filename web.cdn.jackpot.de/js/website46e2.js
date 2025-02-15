/* jshint ignore:start */

// Notification
function notification(type, message) {
    const elm = document.createElement('div');
    elm.classList.add('alert');
    elm.classList.add(type);

    const span = document.createElement('span');
    span.innerHTML = message;

    elm.appendChild(span);

    document.getElementsByTagName('body')[0].appendChild(elm);

    elm.addEventListener('click', function() {
        elm.remove();
    });

    window.setTimeout(() => elm.remove(), 8000);
}

// Ajax
function ajax(method, url, data, success, failure) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    xhr.onreadystatechange = function() {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            if (xhr.status >= 200 && xhr.status <= 299) {
                success(JSON.parse(xhr.response));
            } else {
                failure(JSON.parse(xhr.response));
            }
        }
    }

    if (method === 'POST' && data) {
        data = JSON.stringify(data);

        xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        xhr.send(data);
    } else {
        xhr.send();
    }

    return xhr;
}

// Cookie
(function(Cookie) {
    Cookie.set = (key, value, expireDate) => {
        const expires = !!expireDate ? `; expires=${expireDate.toUTCString()}` : '';
        document.cookie = `${key}=${value}`;
    };

    Cookie.get = key => {
        return document.cookie?.split('; ')?.find(row => row.startsWith(`${key}=`))?.split('=')[1];
    };

    Cookie.remove = key => {
        document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    };
})(cookie = {});

// LocalStorage
(function(LocalStorage) {
    LocalStorage.set = (key, value) => {
        window.localStorage.setItem(key, JSON.stringify(value))
    };

    LocalStorage.get = key => {
        return JSON.parse(window.localStorage.getItem(key));
    };

    LocalStorage.remove = key => {
        window.localStorage.removeItem(key);
    };
})(localStorage = {});

// Tracking
(function(Tracking) {
    Tracking.log = () => {
        if (
            window.WhowEventLog &&
            typeof window.WhowEventLog.track === 'function' &&
            casino.env === 'production'
        ) {
            window.WhowEventLog.track(arguments);
        }
    };
})(tracking = {});

/* Include SSOs */
/* jshint ignore:start */

(function(SsoGoogle) {
    /**
     * Google OAuth login URL
     */
    const OAUTH_LOGIN_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    const OAUTH_REDIRECT_PATH = '/login/google';

    /**
     * Query string parameters for the Google login OAuth URL.
     */
    const OAUTH_QUERY_DATA = {
        client_id: window.casino && window.casino.googleSso && window.casino.googleSso.clientId ? window.casino.googleSso.clientId : null,
        redirect_uri: window.location.protocol + '//' + window.location.host + OAUTH_REDIRECT_PATH,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        scope: 'email+profile',
    };

    /**
     * Build a query string from the Google login parameters
     *
     * @returns {string}
     */
    function buildQueryString() {
        return Object.keys(OAUTH_QUERY_DATA)
            .map(function(key) {
                return key + '=' + OAUTH_QUERY_DATA[key];
            })
            .join('&');
    }

    /**
     * OAUTH Login to Google
     */
    SsoGoogle.login = function() {
        window.location = OAUTH_LOGIN_URL + '?' + buildQueryString();
    };
})(ssoGoogle = {});

 /* jshint ignore:end */

/* jshint ignore:start */

(function(SsoFacebook, Ajax, Notification, LocalStorage, Tracking) {
    /**
     * Handle blocked users
     *
     * @param response
     */
    function handleLoginError(response) {
        if (response.error.message === 'blocked') {
            window.setTimeout(function () {
                window.location = response.error.redirect.replace(/\\/g, "");
            }, 500);
        } else {
            Notification('error', response.error.message);
        }
    }

    /**
     * Handle login success
     */
    function handleLoginSuccess() {
        let redirectTo = LocalStorage.redirectTo || '/';
        const queryString = window.location.search;

        redirectTo += queryString;

        /* globals query */
        if (typeof query.isFacebookCanvas !== 'undefined') {
            Tracking.log('js_fbcanvas', 'canvas', true);
            window.location = '/lpa/facebook-canvas?isFacebookCanvas';
        } else {
            Tracking.log('js_fbcanvas', 'canvas', false);

            if (window.location.href === redirectTo) {
                window.location.reload();
            } else {
                if (queryString) {
                    window.location = redirectTo + '&s=fb';
                } else {
                    window.location = redirectTo + '?s=fb'; //s=fb tells the next page that user registered via facebook
                }
            }
        }
    }
    /**
     * Display a success message
     *
     * @param response
     */
    function displaySuccess(response) {
        Notification('success', response.success.message);
    }

    /**
     * Check if a user is blocked
     *
     * @param response
     * @returns {boolean}
     */
    function isErrorResponse(response) {
        return typeof response.error !== 'undefined' && typeof response.error.message !== 'undefined';
    }

    /**
     * Check whether the response is "successful"
     *
     * @param response
     * @returns {boolean}
     */
    function isSuccessResponse(response) {
        return typeof response.success !== 'undefined' && typeof response.success.message !== 'undefined';
    }

    /**
     * Perform a facebook login
     *
     * @param args
     * @param ageCheck
     */
     SsoFacebook.login = function(args = {}, ageCheck = false) {
        if (typeof args.type === 'undefined') {
            args.type = 'facebook-login';
        }

        try {
            /* globals FB */
            FB.login(function (loginResponse) {
                if (loginResponse.authResponse) {
                    Ajax('POST', '/api/login/facebook', {
                        response: loginResponse.authResponse,
                        signup: {
                            screen: location.hostname + location.pathname //whow tracking (cfigge)
                        },
                        mobileCode: args.mobileCode || null, //code from mobile to merge mobile account to web (optionally)
                        age: ageCheck,
                    }, (response) => {
                        if (isErrorResponse(response)) {
                            handleLoginError(response);
                        } else if (isSuccessResponse(response)) {
                            displaySuccess(response);
                        } else {
                            handleLoginSuccess();
                        }
                    },
                    (response) => {
                        Notification('error', 'A login error has occurred.');
                        console.error(response);
                    });
                } else {
                    Notification('error', 'A login error has occurred.');
                    console.error(loginResponse);
                }
            }, {
                'scope': 'public_profile,email',
                'auth_type': args.scope ? 'rerequest' : null
            });
        } catch (e) {}
    };
})(ssoFacebook = {}, ajax, notification, localStorage, tracking);

 /* jshint ignore:end */

/* jshint ignore:start */

(function(SsoPaypal) {
    /**
     * Paypal OAuth login URL
     */
    const OAUTH_LOGIN_URL = window.casino && window.casino.env === 'production' ? 'https://www.paypal.com/signin/authorize' : 'https://www.sandbox.paypal.com/signin/authorize';
    const OAUTH_REDIRECT_PATH = '/login/paypal';

    /**
     * Query string parameters for the Paypal login OAuth URL.
     */
    const OAUTH_QUERY_DATA = {
        client_id: window.casino && window.casino.paypalSso ? window.casino.paypalSso.clientId : null,
        redirect_uri: window.location.protocol + '//' + window.location.host + OAUTH_REDIRECT_PATH,
        flowEntry: 'static',
        response_type: 'code',
        scope: 'openid email profile',
    };

    /**
     * Build a query string from the Paypal login parameters
     *
     * @returns {string}
     */
    function buildQueryString() {
        return Object.keys(OAUTH_QUERY_DATA)
            .map(function(key) {
                return key + '=' + OAUTH_QUERY_DATA[key];
            })
            .join('&');
    }

    /**
     * OAUTH Login to Paypal
     */
    SsoPaypal.login = function() {
        window.location = OAUTH_LOGIN_URL + '?' + buildQueryString();
    };
})(ssoPaypal = {});

 /* jshint ignore:end */


(function(Ajax, Notification, SsoGoogle, SsoFacebook, SsoPaypal) {
    // General things for logic below
    const removeActive = function() {
        document.querySelectorAll('[data-target], section.login, section.signup').forEach(function(element) {
            element.classList.remove('active');
        });
    };

    const backdrop = function(onOrOff) {
        if (typeof onOrOff === 'undefined' || !onOrOff) {
            document.querySelector('body').classList.remove('backdrop');
        } else {
            document.querySelector('body').classList.add('backdrop');
        }
    };

    // Logic for login / signup tabs
    document.querySelectorAll('[data-target]').forEach(function(e) {
        e.addEventListener('click', function() {
            removeActive();
            this.classList.add('active');

            document.querySelectorAll(this.getAttribute('data-target')).forEach(function(element) {
                element.classList.add('active');
            });
        });
    });

    // Logic for backdrop
    function isIndexPage() {
        return window.location.pathname === '/';
    }

    const loginButtonElement = document.querySelector('header .login button');
    // youre-casino has custom login button
    if (loginButtonElement) {
        loginButtonElement.addEventListener('click', () => {
            if (!isIndexPage()) {
                document.querySelector('section.login-signup').style.display = 'block';
            }

            removeActive();
            document.querySelector('[data-target="section.login"]').classList.add('active');
            document.querySelector('section.login').classList.add('active');
            backdrop(true);
        });
    }

    const signupButtonElement = document.querySelector('header .signup button');
    // youre-casino has custom login button
    if (signupButtonElement) {
        signupButtonElement.addEventListener('click', () => {
            if (!isIndexPage()) {
                document.querySelector('section.login-signup').style.display = 'block';
            }

            removeActive();
            document.querySelector('[data-target="section.signup"]').classList.add('active');
            document.querySelector('section.signup').classList.add('active');
            backdrop(true);
        });
    }

    const closeBackdrop = document.querySelector('.close-backdrop');
    if (closeBackdrop) {
        closeBackdrop.addEventListener('click', () => {
            if (!isIndexPage()) {
                document.querySelector('section.login-signup').style.display = 'none';
            }

            backdrop(false);
        });
    }

    function trackBetgeniusPixel(params) {
        var script = document.createElement('script'), callback = null;
        script.type = 'text/javascript';
        script.src = 'https://zz.connextra.com/dcs/tagController/tag/94094b0da329/' + params;
        script.async = true;
        script.defer = true;

        document.head.appendChild(script);
    }

    function trackSportRadarStartPixel() {
        if (typeof srtmCommands !== 'undefined') {
            srtmCommands.push({
                event: 'track.user.registration',
                payload: {
                    action: 'start'
                }
            });
        }
    }

    // logic for signup more
    function showSignupMore() {
        if (!document.querySelector('.signup-step2').classList.contains('hidden') &&
            document.querySelector('.signup-more').classList.contains('hidden')
        ) {
            return false;
        }

        document.querySelectorAll('.signup-step2').forEach((elm) => {
            elm.classList.remove('hidden');
        });

        document.querySelector('.signup-more').classList.add('hidden');

        const signupNameElement = document.getElementById('signup-name');
        if (signupNameElement) {
            signupNameElement.classList.add('woblur');
        }
        // Pixels below are for Merkur casino only
        if (casino.slug === 'merkur24-com') {
            // 1. Track Betgenius pixel
            trackBetgeniusPixel('regstart');

            // 2. Track SportRadar pixel
            trackSportRadarStartPixel();
        }
    }

    const signupMoreElement = document.querySelector('.signup-more');
    if (signupMoreElement) {
        signupMoreElement.addEventListener('click', () => {
            showSignupMore();
        });
    }

    const signupNameElement = document.getElementById('signup-name');
    if (signupNameElement) {
        signupNameElement.addEventListener('input', () => {
            let timeout;

            window.clearTimeout(timeout);

            if (document.getElementById('signup-name').value.length >= 2) {
                timeout = window.setTimeout(function () {
                    showSignupMore();
                }, 500);
            }
        });
    }

    // Logic for password forgotten
    const passwordForgottenLinkElement = document.getElementById('password-forgotten-link');
    if (passwordForgottenLinkElement) {
        passwordForgottenLinkElement.addEventListener('click', () => {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('password-form').classList.remove('hidden');
        });
    }

    const backToLoginLinkElement = document.getElementById('back-to-login-link');
    if (backToLoginLinkElement) {
        backToLoginLinkElement.addEventListener('click', () => {
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('password-form').classList.add('hidden');
        });
    }

    // login
    function login(action) {
        Ajax('POST', action, {
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value,
            persists: 1
        }, (response) => {
            if (!response.errors.length) {
                window.setTimeout(() => {
                    window.location = '/' + window.location.search;
                }, 500);
            } else {
                if ( //check for blocked users
                    response.errors[0].message === 'blocked'
                ) {
                    window.setTimeout(() => {
                        window.location = response.errors[0].redirect.replace(/\\/g, "");
                    }, 500);
                } else {
                    Notification('error', response.errors.map(e => e.message).join('<br>'));
                }
            }
        },
        (response) => {
            Notification('error', 'A login error has occurred.');
            console.error(response);
        });
    }

    if (document.getElementById('login-form') && !hasCustomLogin) {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();

            login(e.target.action);
        })
    }

    if (document.getElementById('instant-play-form')) {
        if (document.getElementById('signup-form')) {
            toggleSignupForm(true);
        }

        document.getElementById('instant-play-form').addEventListener('submit', (e) => {
            e.preventDefault();

            signup(e.target.action);
        });

        document.getElementById('button-show-signup').addEventListener('click', (e) => {
            e.preventDefault();
            toggleSignupForm(false);
            showSignupMore();
        });
    }

    function toggleSignupForm(hide) {
        if (!document.getElementById('signup-form')) {
            return;
        }

        if (hide) {
            document.getElementById('signup-form').classList.add('hidden');
            document.getElementById('instant-play').classList.remove('hidden');
        } else {
            document.getElementById('signup-form').classList.remove('hidden');
            document.getElementById('instant-play').classList.add('hidden');
        }
    }

    // password forgotten
    function passwordForgotten(action) {
        Ajax('POST', action, {
            email: document.getElementById('password-email').value,
        }, (response) => {
            if (!response.errors.length) {
                document.getElementById('password-form').classList.add('hidden');
                document.getElementById('login-form').classList.remove('hidden');

                Notification('success', response.successes[0].message);
            } else {
                Notification('error', response.errors.map(e => e.message).join('<br>'));
            }
        },
        (response) => {
            Notification('error', 'An error occurred while attempting to resend a password.');
            console.error(response);
        });
    }

    if (document.getElementById('password-form')) {
        document.getElementById('password-form').addEventListener('submit', (e) => {
            e.preventDefault();

            passwordForgotten(e.target.action);
        })
    }

    // signup
    function signup(action) {
        let post = {
            username: document.getElementById('signup-name').value,
            email: document.getElementById('signup-email').value,
            password: document.getElementById('signup-password').value,
            persists: true,
            age: true,
            dataAgreement: true,
            termsAndConditions: document.getElementById('terms-and-conditions').checked,
            newsletter: document.getElementById('newsletter').checked,
            signup: { // tracking
                screen: location.hostname + location.pathname,
            },
        };

        /* merkur age checkbox */
        if (document.getElementById('age') && !document.getElementById('age').checked) {
            post.age = false;
        }

        /* add dsid to signup params if duarblestorage is available */
        if (typeof ds !== 'undefined') {
            ds.get("dsid", function(value) {
                post.dsid = value || null;
            });
        }

        Ajax('POST', action, post, (response) => {
            if (!response?.errors?.length) {
                if (response?.successes?.length) {
                    Notification('success', response.successes.map(e => e.message).join('<br>'));
                } else {
                    let lsUser = window.localStorage.getItem('user');

                    if (lsUser?.length) {
                        lsUser = JSON.parse(lsUser);
                        window.localStorage.setItem('user', JSON.stringify(Object.assign(lsUser, {
                            email: document.getElementById('signup-email').value,
                        })));
                    } else {
                        window.localStorage.setItem('user', JSON.stringify({
                            email: document.getElementById('signup-email').value,
                        }));
                    }

                    const queryString = window.location.search;
                    let redirectTo = response.redirect || window.localStorage.getItem('redirectTo');

                    redirectTo = !redirectTo ? '/' : redirectTo;
                    redirectTo += queryString;
                    window.location = redirectTo;
                }
            } else {
                // check for blocked users
                if (response?.errors[0]?.message === 'blocked') {
                    window.setTimeout(function() {
                        window.location = response.errors[0].redirect.replace(/\\/g, "");
                    }, 500);
                } else {
                    Notification('error', response.errors.map(e => e.message).join('<br>'));
                }
            }
        },
        (response) => {
            Notification('error', 'An error occurred while attempting to register.');
            console.error(response);
        });
    }

    if (document.getElementById('signup-form')) {
        document.getElementById('signup-form').addEventListener('submit', (e) => {
            e.preventDefault();

            signup(e.target.action);
        })
    }

    function sso(service) {
        switch (service) {
            case 'google':
                SsoGoogle.login();
                break;

            case 'fbook':
                SsoFacebook.login();
                break;

            case 'paypal':
                SsoPaypal.login();
                break;
            case 'youre':
                const classList = document.getElementById('signup-form').parentElement.classList;
                const locale = document.getElementById('signup-form').getAttribute('locale');

                if (classList.contains('signup') && classList.contains('active')) {
                    window.location = '/signup/' + service + '?locale=' + locale;
                } else {
                    window.location = '/login/' + service + '?locale=' + locale;
                }
                break;
        }
    }

    ['google', 'fbook', 'youre', 'paypal'].forEach(service => {
        document.querySelectorAll(`.sso-button-${service}`).forEach(btn => {
            btn.addEventListener('click', () => {
                sso(service);
            });
        });
    });

    if (cookie.get('registered')) {
        const sectionLoginElement = document.querySelector('[data-target="section.login"]');
        if (sectionLoginElement) {
            sectionLoginElement.click();
        }
    }

    // navigation (burger menu)
    function toggleTopNavElement(id) {
        const topnav = document.getElementById(id);

        if (topnav.classList.contains('hidden')) {
            topnav.classList.remove('hidden');
        } else {
            topnav.classList.add('hidden');
        }
    }

    document.getElementById('nav-toggle').addEventListener('click', () => {
        toggleTopNavElement('topnav');
    });

    document.getElementById('topnav-languages-toogle').addEventListener('click', () => {
        toggleTopNavElement('topnav-languages');
    });

    /* Settings sidebar */
    const settingsElm = document.querySelector('sidebar.settings');

    settingsElm.addEventListener('mouseenter', elm => {
        elm.target.querySelector('ul').classList.add('visible');
    })
    settingsElm.addEventListener('mouseleave', elm => {
        elm.target.querySelector('ul').classList.remove('visible');
    });
})(ajax, notification, ssoGoogle, ssoFacebook, ssoPaypal);

/* Detect iPads */

function isiPad () {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return userAgent.indexOf('ipad') > -1 || userAgent.indexOf('macintosh') > -1 && 'ontouchend' in document;
}

if (isiPad()) {
    document.querySelector('body').classList.add('mobile');
}

/* jshint ignore:end */
