var _ = require('underscore')
  , querystring = require('querystring')
  , Strategy = require('./strategy')
  , q = require('../../q')
  , bogart = require('../../bogart')
  , path = require('path');

module.exports = Password;

/**
 * Settings:
 *
 * - loginPath {String} The path of the login route. Default: `/login`
 * - logoutPath {String} The path of the logout route. Default: `/logout`
 * - registerPath {String} The path to the register route. Default: `/register`
 * - loginParam {String} The name of the login field on the login view. Default: `login`
 * - passwordParam {String} The name of the password field on the login view. Default: `password`
 * - 
 *
 * @
 * @param {Object} strategy
 *
 */
function Password() {
  var protectedResources = null;

  if (arguments.length === 0) {
    strategy = {};
  } else {
    var args = Array.prototype.slice.call(arguments);
    strategy = args.pop();
    protectedResources = args;
  }

  strategy.sessionUserKey = strategy.sessionUserKey || 'user';

  strategy.loginPath = strategy.loginPath || '/login';
  strategy.logoutPath = strategy.logoutPath || '/logout';
  strategy.registerPath = strategy.registerPath || '/register';
  strategy.defaultLoginSuccessRedirect = strategy.defaultLoginSuccessRedirect || '/';

  strategy.serializeUser = strategy.serializeUser || JSON.stringify;
  strategy.deserializeUser = strategy.deserializeUser || JSON.parse;

  strategy.views = strategy.views || new Views();

  var passwordRouter = bogart.router();

  passwordRouter.get(strategy.loginPath, getLogin(strategy));
  passwordRouter.post(strategy.loginPath, postLogin(strategy));

  passwordRouter.post(strategy.logoutPath, logout(strategy));
  passwordRouter.del(strategy.logoutPath, logout(strategy));

  passwordRouter.get(strategy.registerPath, getRegister(strategy));
  passwordRouter.post(strategy.registerPath, postRegister(strategy));

  if (protectedResources === null) {
    // Protect everything except for the login and register routes by default.
    passwordRouter.notFound(protectedRouteHandler);
  } else {
    protectedResources.forEach(function (resource) {
      routeAll(passwordRouter, resource, protectedRouteHandler);
    });
  }

  return passwordRouter;

  function protectedRouteHandler(req, next) {
    if (!res.session.hasKey('user')) {
      return bogart.redirect(session.loginPath);
    }

    return next(req);
  }
}

var httpMethods = ['get','post','put','delete'];
function forEachHttpMethod(fn) {
  httpMethods.forEach(fn);
}

function routeAll(router, path, handler) {
  forEachHttpMethod(function (method) {
    router.route(method, path, handler);
  });
}

function errorsParam(strategy, req) {
  return req.params[strategy.errorsParam || 'errors'];
}

function loginParam(strategy, req) {
  return req.params[strategy.loginParam || 'login'];
}

function passwordParam(strategy, req) {
  return req.params[strategy.passwordParam || 'password'];
}

function verifyCredentials(strategy, login, password) {
  return q.when(strategy.verifyCredentials(login, password));
}

function getUser(strategy, login) {
  return q.when(strategy.getUser(login));
}

function addUserToSession(req, strategy, user) {
  req.session(strategy.sessionUserKey, strategy.serializeUser(user));
}

function redirectOnLoginSuccess(req, strategy) {
  return bogart.redirect(req.params.returnUrl || strategy.defaultLoginSuccessRedirect);
}

function redirectOnLoginFailure(strategy) {
  return function (req) {
    return bogart.redirect(strategy.loginPath+'?errors=["Invalid login or password"]');
  }
}

function getLogin(strategy) {
  return function (req) {
    var viewOpts = {};

    if (typeof strategy.layout !== 'undefined') {
      viewOpts.layout = strategy.layout;
    }

    return q.when(strategy.views.login(viewOpts), function (html) {
      return {
        status: 200,
        headers: {},
        body: [ html ]
      }
    });
  }
}

function postLogin(strategy) {
  return function (req) {
    var login = loginParam(strategy, req)
      , password = passwordParam(strategy, req)

    return verifyCredentials(strategy, login, password).then(function (verified) {
      if (verified) {
        return getUser(strategy, login).then(function (user) {
          addUserToSession(req, strategy, user);
          return redirectOnLoginSuccess(req, strategy);
        });
      } else {
        return redirectOnLoginFailure(strategy)(req);
      }
    });
  }
}

function getRegister(strategy) {
  return function (req) {
    return {
      status: 200,
      headers: {},
      body: [ strategy.views.register() ]
    }
  }
}

function postRegister(strategy) {

}

function logout(strategy) {
  return function (req) {
    req.session.remove(strategy.sessionUserKey);

    return bogart.redirect(strategy.defaultLoginSuccessRedirect || '/');
  };
}

function Views() {
  var viewEngine = bogart.viewEngine('mustache', path.join(__dirname, 'views'));

  this.login = function (opts) {
    opts = opts || {};

    if (typeof opts.layout === 'undefined') {
      opts.layout = false;
    }

    return viewEngine.render('login.html', opts);
  }
}