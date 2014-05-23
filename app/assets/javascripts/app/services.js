angular.module('popcornApp.services', [])
.service('MoviesService', 
	function($q, $http, Movie, $cacheFactory) {
		/* helper function for data extraction in json below */
		var getNested = function(data, path) {
			var i, len = path.length;
			for(i = 0; typeof data === 'object' && i < len; ++i){
				data = data[path[i]];
			}
			return data;
		};
		
		var moviesCache = $cacheFactory('movies');
		
		this.movies = function(chart) {
			var d = $q.defer();
		    chart = typeof chart !== 'undefined' ? chart : "most_popular";
			var cachedMovies = moviesCache.get(chart);
		    if(cachedMovies) {
     			 d.resolve(cachedMovies);
    		} else {

			$http({
				method: 'GET',
				url: 'http://gdata.youtube.com/feeds/api/charts/movies/'+ chart +'?v=2&max-results=20&paid-content=true&hl=en&region=us&alt=json'
			}).
			then(function(response) {
			  var movies = _.map(response.data.feed.entry, 
				function(movie) {
		          return {
		            youtubeId: movie['media$group']['yt$videoid']['$t'],
		            title: movie['media$group']['media$title']['$t'], 
		            released: movie['yt$firstReleased']['$t'].match(/\d{4}/)[0],
		            rated: getNested(movie, ['media$group','media$rating', 0,'$t']),
		            runningTime: Math.round(movie['media$group']['yt$duration']['seconds'] / 60),
		            posterUrl: _.findWhere(movie['media$group']['media$thumbnail'], {"yt$name": "poster"}).url,
		            description: movie['media$group']['media$description']['$t']          
		          };
				});
			  
			  moviePromises = _.map(movies, function(movieData) {
			  	var youtubeId = movieData.youtubeId;
			  	return Movie.findOrCreateByYoutubeId(youtubeId, movieData);
			  });

			$q.all(moviePromises).then(function(movieResources) {
			  	moviesCache.put(chart, movieResources);
			  	d.resolve(movieResources);
			  });
				
			}, function(error) {
				d.reject(error);	
			});
		}
			return d.promise;
		
	  }	
	})
.service('AuthService',
    function($rootScope, $q, $cookieStore) {
        var service = this;
        this._user = null;
        this.setCurrentUser = function(u) {
            service._user = u;
            $cookieStore.put('user', u);
            $rootScope.$broadcast("user:set", u);
        };
        this.removeCurrentUser = function() {
            service._user = null;
            $cookieStore.remove('user');
            $rootScope.$broadcast("user:unset");
        };
        this.currentUser = function() {
            var d = $q.defer();
            if(service._user) {
                d.resolve(service._user);
            } else if($cookieStore.get('user')) {
                service.setCurrentUser($cookieStore.get('user'));
                d.resolve(service._user);
            } else {
                d.resolve(null);
            }
            return d.promise;
        };
    })
.service('UserService',
    function($rootScope, $q, $cookieStore, $http, AuthService) {
        this.currentUser = AuthService.currentUser;

        this.login = function(params) {
            var d = $q.defer();
            $http({
                url: '/users/sign_in',
                method: 'POST',
                data: {
                    user: params
                }
            }).success(function(response) {
                if(response.success) {
                    var user = response.data.user;
                    user.auth_token = response.data.auth_token;
                    AuthService.setCurrentUser(user);
                    d.resolve(user);
                } else {
                    d.reject(response)
                }
            }).error(function(reason) {
                d.reject(reason);
            });
            return d.promise;
        };
        this.logout = function() {
            var d = $q.defer();
            AuthService.removeCurrentUser();
            d.resolve();
            return d.promise;
        };
        this.signup = function(params) {
            var d = $q.defer();
            $http({
                url: '/users',
                method: 'POST',
                data: {
                    user: params
                }
            }).success(function(response) {
                var user = response.data.user;
                user.auth_token = response.data.auth_token;
                AuthService.setCurrentUser(user);
                d.resolve(user);
            }).error(function(reason) {
                d.reject(reason);
            });
            return d.promise;
        };
    });