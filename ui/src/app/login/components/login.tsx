import {FormField} from 'argo-ui';
import React, {useContext, useEffect, useState} from 'react';
import {Form, Text} from 'react-form';
import {RouteComponentProps} from 'react-router';
import {AuthSettings} from '../../shared/models';
import {services} from '../../shared/services';
import {Context} from '../../shared/context';

require('./login.scss');

export interface LoginForm {
    username: string;
    password: string;
}

export function Login(props: RouteComponentProps<{}>) {
    const appContext = useContext(Context);

    const search = new URLSearchParams(props.history.location.search);
    const returnUrl = search.get('return_url') || '';
    const hasSsoLoginError = search.get('has_sso_error') === 'true';

    const [authSettings, setAuthSettings] = useState<AuthSettings | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loginInProgress, setLoginInProgress] = useState<boolean>(false);

    const postLoginRedirect = (returnURL: string) => {
        if (returnURL) {
            const url = new URL(returnURL, window.location.origin);
            if (url.origin === window.location.origin) {
                return `${url.pathname}${url.search}${url.hash}`;
            }
        }

        const normalizedBaseHref = appContext.baseHref === '/' ? '' : appContext.baseHref.replace(/\/$/, '');
        return `${normalizedBaseHref}/applications`;
    };

    useEffect(() => {
        (async () => {
            const authSettings = await services.authService.settings();
            setAuthSettings(authSettings);
        })();
    }, []);

    const login = async (username: string, password: string, returnURL: string) => {
        try {
            setLoginError('');
            setLoginInProgress(true);
            appContext.navigation.goto('.', {sso_error: null});
            await services.users.login(username, password);
            setLoginInProgress(false);
            // Force a full reload after login so API calls start after the
            // session cookie is available to the browser.
            window.location.assign(postLoginRedirect(returnURL));
        } catch (e) {
            setLoginError(e.response.body.error);
            setLoginInProgress(false);
        }
    };

    const ssoConfigured = authSettings && ((authSettings.dexConfig && (authSettings.dexConfig.connectors || []).length > 0) || authSettings.oidcConfig);

    return (
        <div className='login'>
            <img className='login__hero-logo' src='assets/images/logo-transparent.png' alt='Clustra Deploy' />
            <img className='login__text-logo' src='assets/images/clustra-text-logo.png' alt='Clustra AI' />
            <div className='login__text'>Deploy Sovereign AI Models</div>
            <div className='login__box'>
                {ssoConfigured && (
                    <div className='login__box_saml width-control'>
                        <a href={`auth/login?return_url=${encodeURIComponent(returnUrl)}`}>
                            <button className='argo-button argo-button--base argo-button--full-width argo-button--xlg'>
                                {(authSettings.oidcConfig && <span>Log in via {authSettings.oidcConfig.name}</span>) ||
                                    (authSettings.dexConfig.connectors.length === 1 && <span>Log in via {authSettings.dexConfig.connectors[0].name}</span>) || (
                                        <span>SSO Login</span>
                                    )}
                            </button>
                        </a>
                        {hasSsoLoginError && <div className='argo-form-row__error-msg'>Login failed.</div>}
                        {authSettings && !authSettings.userLoginsDisabled && (
                            <div className='login__saml-separator'>
                                <span>or</span>
                            </div>
                        )}
                    </div>
                )}
                {authSettings && !authSettings.userLoginsDisabled && (
                    <Form
                        onSubmit={(params: LoginForm) => login(params.username, params.password, returnUrl)}
                        validateError={(params: LoginForm) => ({
                            username: !params.username && 'Username is required',
                            password: !params.password && 'Password is required'
                        })}>
                        {formApi => (
                            <form role='form' className='width-control' onSubmit={formApi.submitForm}>
                                <div className='argo-form-row'>
                                    <FormField
                                        formApi={formApi}
                                        label='Username'
                                        field='username'
                                        component={Text}
                                        componentProps={{name: 'username', autoCapitalize: 'none', autoComplete: 'username'}}
                                    />
                                </div>
                                <div className='argo-form-row'>
                                    <FormField
                                        formApi={formApi}
                                        label='Password'
                                        field='password'
                                        component={Text}
                                        componentProps={{name: 'password', type: 'password', autoComplete: 'password'}}
                                    />
                                    {loginError && <div className='argo-form-row__error-msg'>{loginError}</div>}
                                </div>
                                <div className='login__form-row'>
                                    <button disabled={loginInProgress} className='argo-button argo-button--full-width argo-button--xlg' type='submit'>
                                        Sign In
                                    </button>
                                </div>
                            </form>
                        )}
                    </Form>
                )}
                {authSettings && authSettings.userLoginsDisabled && !ssoConfigured && (
                    <div className='argo-form-row__error-msg'>Login is disabled. Please contact your system administrator.</div>
                )}
            </div>
        </div>
    );
}
