(function(window, angular) {
'use strict';

angular.module('pouchdb', [])
  .constant('POUCHDB_DEFAULT_METHODS', [
    'destroy',
    'put',
    'post',
    'get',
    'remove',
    'bulkDocs',
    'allDocs',
    'putAttachment',
    'getAttachment',
    'removeAttachment',
    'query',
    'viewCleanup',
    'info',
    'compact',
    'revsDiff'
  ])
  .provider('pouchDB', ["POUCHDB_DEFAULT_METHODS", function(POUCHDB_DEFAULT_METHODS) {
    this.methods = POUCHDB_DEFAULT_METHODS;
    this.$get = ["$q", "$window", function($q, $window) {
      var methods = this.methods;

      function qify(fn) {
        return function() {
          return $q.when(fn.apply(this, arguments));
        };
      }

      function qify_put(fn) {
          return function() {

              var scope = this,
                  scopeArguments = arguments,
                  _id, _object,
                  deferred = $q.defer(),
                  newRecord = function(response) {

                  if ( !angular.isDefined(_object._rev) ) {       // Check if we have manually provided _rev, if yes, skip it.
                      if( angular.isDefined(response._rev) ) {    // Is PUT an update or new document?
                          _object._rev = response._rev;           // PUT is an update, pass on the _rev.
                      }
                  }

                  return $q.when(fn.apply(scope, scopeArguments)).then(function(resp) {
                      deferred.resolve(resp);
                  }).catch(function(err) {
                      deferred.reject(err);
                  });

              };

              if ( arguments.length === 1 ) {
                  // Set by ojbect: db.put({ _id: '_id', content: 'test'})
                  _id = arguments[0]._id || null;
                  _object = arguments[0] || {};

              } else if( arguments.length === 2 || arguments.length === 3 ) {
                  // Set by string: db.put({content: 'test'}, '_id') or db.put({content: 'test'}, '_id', '_rev')
                  _id = arguments[1] || null;
                  _object = arguments[0] || {};
              }

              db.get(_id).then(newRecord).catch(newRecord);

              return deferred.promise;
          };
      }

      function wrapEventEmitters(db) {
        function wrap(fn) {
          return function() {
            var deferred = $q.defer();
            var emitter = fn.apply(this, arguments)
              .on('change', function(change) {
                return deferred.notify(change);
              })
              .on('uptodate', function(uptodate) {
                return deferred.notify(uptodate);
              })
              .on('complete', function(response) {
                return deferred.resolve(response);
              })
              .on('error', function(error) {
                return deferred.reject(error);
              });
            emitter.$promise = deferred.promise;
            return emitter;
          };
        }

        db.changes = wrap(db.changes);
        db.replicate.to = wrap(db.replicate.to);
        db.replicate.from = wrap(db.replicate.from);

        return db;
      }

      return function pouchDB(name, options) {
        var db = new $window.PouchDB(name, options);
        function wrap(method) {
            if(method === "put") {
                db[method] = qify_put(db[method]);
            } else {
                db[method] = qify(db[method]);
            }
        }
        methods.forEach(wrap);
        return wrapEventEmitters(db);
      };
    }];
  }]);
})(window, window.angular);
