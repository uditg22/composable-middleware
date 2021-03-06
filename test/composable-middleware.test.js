
'use strict';

require('should');
var assert= require('assert');
var http = require('http');
var request = require('request');
var async = require('async');
var composable = require('../');
var port= 3000;

var composable_middleware = require( '../lib/composable-middleware.js' );

function serve(middleware,requests,done) {
  var server= http.createServer(function(req,res){
    res.send= function(status,body) {
      if (1 == arguments.length) {
        body= status;
        status= 200;
      }
      this.statusCode= status;
      this.end(body);
    }
    middleware(req,res,function(err) {
      if (err) {
        done(err);
      }
    });
  })
  async.series(requests,function (){
    server.close(function() {
      done();
    });
  })
  server.listen(port)
}

function get(url,expected,done) {
  request.get('http://localhost:'+port+url, function (error, response, body) {
    response.statusCode.should.equal(200);
    body.should.equal(expected);
    done();
  })
}

function prepare_msg(req,res,next)
{
  req.msg= '';
  next();
}

function send_msg(req,res,next)
{
  res.send(req.msg);
}

function mw(symbol)
{
  return function(req,res,next) {
    req.msg+= symbol;
    next();
  }
}


describe( 'this test server', function() {
  it( 'should run a simple request through very simple middleware', function(done) {
    serve(
      function(req,res,next) {
        res.send('ok');
      },
      [
        function(cb) {
          get('/','ok',cb)
        },
      ],
      done
    );
  } );
  it( 'should be able to run a second time', function(done) {
    serve(
      function(req,res,next) {
        res.send('ok');
      },
      [
        function(cb) {
          get('/','ok',cb)
        },
      ],
      done
    );
  } );
} );
describe( 'composable-middleware', function() {
  describe( 'composable_middleware()', function() {
    it( 'should be a function', function() {
      composable_middleware.should.be.a( 'function' );
    } );
    it( 'should return a function', function() {
      composable_middleware().should.be.a( 'function' );
    } );
  } );
  it( 'should run a simple request through simple middleware', function(done) {
    serve(
      composable([
        function(req,res,next) {
          res.send('okay');
        }
      ]),
      [
        function(cb) {
          get('/','okay',cb)
        },
      ],
      done
    );
  } );
  it( 'should run a simple request through two layers of middleware', function(done) {
    serve(
      composable([
        function(req,res,next) {
          req.msg= 'it is ';
          next();
        },
        function(req,res,next) {
          res.send(req.msg+'okay');
        }
      ]),
      [
        function(cb) {
          get('/','it is okay',cb)
        },
      ],
      done
    );
  } );
  it( 'should support multiple steps in the function argument without them being wrapped in an array', function(done) {
    serve(
      composable(
        function(req,res,next) {
          req.msg= 'it is ';
          next();
        },
        function(req,res,next) {
          res.send(req.msg+'okay');
        }
      ),
      [
        function(cb) {
          get('/','it is okay',cb)
        },
      ],
      done
    );
  } );
  it( 'should run a middleware within middleware', function(done) {
    serve(
      composable(
        function(req,res,next) {
          req.msg= 'a';
          next();
        },
        composable([
          function(req,res,next) {
            req.msg+= '1';
            next();
          },
          function(req,res,next) {
            req.msg+= '2';
            next();
          },
        ]),
        function(req,res,next) {
          res.send(req.msg+'b');
        }
      ),
      [
        function(cb) {
          get('/','a12b',cb)
        },
      ],
      done
    );
  } );
  it( 'should run a middleware within middleware where inner is first', function(done) {
    serve(
      composable(
        composable(
          function(req,res,next) {
            req.msg= '1';
            next();
          },
          function(req,res,next) {
            req.msg+= '2';
            next();
          }
        ),
        function(req,res,next) {
          req.msg+= 'a';
          next();
        },
        function(req,res,next) {
          res.send(req.msg+'b');
        }
      ),
      [
        function(cb) {
          get('/','12ab',cb)
        },
      ],
      done
    );
  } );
  it( 'should run a middleware within middleware where inner is last', function(done) {
    serve(
      composable(
        function(req,res,next) {
          req.msg= 'a';
          next();
        },
        function(req,res,next) {
          req.msg+= 'b';
          next();
        },
        composable(
          function(req,res,next) {
            req.msg+= '1';
            next();
          },
          function(req,res,next) {
            req.msg+= '2';
            res.send(req.msg);
          }
        )
      ),
      [
        function(cb) {
          get('/','ab12',cb)
        },
      ],
      done
    );
  } );
  it( 'should allow middleware to be referenced by a variable', function(done) {
    var onetwo=
      composable(
        function(req,res,next) {
          req.msg+= '1';
          next();
        },
        function(req,res,next) {
          req.msg+= '2';
          res.send(req.msg);
        }
      );

    var ab=
      composable(
        function(req,res,next) {
          req.msg= 'a';
          next();
        },
        function(req,res,next) {
          req.msg+= 'b';
          next();
        },
        onetwo
      );

    serve(
      ab,
      [
        function(cb) {
          get('/','ab12',cb)
        },
      ],
      done
    );
  } );
  it( 'should allow concatenation of middleware', function(done) {
    var onetwo=
      composable(
        mw('1'),
        mw('2')
      );

    var ab=
      composable(
        mw('a'),
        mw('b')
      );

    serve(
      composable(
        prepare_msg,
        onetwo,
        ab,
        send_msg
      ),
      [
        function(cb) {
          get('/','12ab',cb)
        },
      ],
      done
    );
  } );
  it( 'should support a use function', function(done) {
    var onetwo=
      composable()
        .use(mw('1'))
        .use(mw('2'));

    var ab=
      composable()
        .use(mw('a'))
        .use(mw('b'));

    serve(
      composable(
        prepare_msg,
        onetwo,
        ab,
        send_msg
      ),
      [
        function(cb) {
          get('/','12ab',cb)
        },
      ],
      done
    );
  } );
  it( 'should recognize error-handling middleware and route next(err) to it, bypassing any intermediate middleware', function(done) {
    serve(
      composable()
        .use(prepare_msg)
        .use(mw('a'))
        .use(function (req,res,next) {
          next('error!')
        })
        .use(mw('b'))
        .use(function (err,req,res,next) {
          res.send(err+' '+req.msg);
        })
        .use(send_msg)
      ,
      [
        function(cb) {
          get('/','error! a',cb)
        },
      ],
      done
    );
  } );
  it( 'should work as expected if the error-handling middleware is right after the middleware producing an error', function(done) {
    serve(
      composable()
        .use(prepare_msg)
        .use(mw('a'))
        .use(function (req,res,next) {
          next('error!')
        })
        .use(function (err,req,res,next) {
          res.send(err+' '+req.msg);
        })
        .use(send_msg)
      ,
      [
        function(cb) {
          get('/','error! a',cb)
        },
      ],
      done
    );
  } );
  it( 'should go back to the normal stack if an error handler calls next() without an err argument', function(done) {
    serve(
      composable()
        .use(prepare_msg)
        .use(mw('a'))
        .use(function (req,res,next) {
          next('error!')
        })
        .use(function (err,req,res,next) {
          req.msg= req.msg+err;
          next();
        })
        .use(send_msg)
      ,
      [
        function(cb) {
          get('/','aerror!',cb)
        },
      ],
      done
    );
  } );
  it( 'should allow an error handler to punt the error to the next error handler', function(done) {
    serve(
      composable()
        .use(function (req,res,next) {
          next()
        })
        .use(
              composable()
                .use(prepare_msg)
                .use(mw('a'))
                .use(function (req,res,next) {
                  next('error!')
                })
                .use(function (err,req,res,next) {
                  req.msg= req.msg+err;
                  next(err);
                })
                .use(function (err,req,res,next) {
                  req.msg= req.msg+err;
                  next();
                })
                .use(send_msg)
                )
      ,
      [
        function(cb) {
          get('/','aerror!error!',cb)
        },
      ],
      done
    );
  } );
  it( 'should allow later additions', function(done) {
    var ab= composable(
      mw('a'),
      mw('b')
    );
    var full= composable(
      prepare_msg,
      ab,
      send_msg
    );
    serve(
      full,
      [
        function(cb) {
          get('/','ab',function() {
            ab.use(mw('c'));
            get('/x','abc',function() {
              cb();
            })
          })
        }
      ],
      done
    );
  } );
  it( 'should reject use() argument other than middleware function or array of', function() {
    (function () {
        var ab= composable('a')
    }).should.throw();
  });
  it( 'should reject use() of a function with unexpected arity', function() {
    (function () {
        var ab= composable(function(a,b,c,d,e) {})
    }).should.throw();
  });
  it( 'should support both connect and Flatiron Union middleware', function(done) {
    serve(
      composable([
        function() {    // flatiron middleware
          this.req.msg= 'a';
          this.res.emit('next');
        },
        function(req,res,next) {  // Connect middleware
          res.send(req.msg+'b');
        }
      ]),
      [
        function(cb) {
          get('/','ab',cb)
        },
      ],
      done
    );
  } );
  it( 'should support hybrid middleware as well as Union and Connect middleware', function(done) {
    serve(
      composable([
        function() {    // flatiron middleware
          this.req.msg= 'a';
          this.res.emit('next');
        },
        function(next) {    // hybrid middleware
          this.req.msg+= 'b';
          next();
        },
        function(req,res,next) {  // Connect middleware
          res.send(req.msg+'c');
        }
      ]),
      [
        function(cb) {
          get('/','abc',cb)
        },
      ],
      done
    );
  } );

  it( 'should recognize hybrid error-handling middleware and route next(err) to it, bypassing any intermediate middleware', function(done) {
    serve(
      composable()
        .use(prepare_msg)
        .use(mw('a'))
        .use(function (req,res,next) {
          next('error!')
        })
        .use(mw('b'))
        .use(function (err,next) {
          this.res.send(err+' '+this.req.msg);
        })
        .use(send_msg)
      ,
      [
        function(cb) {
          get('/','error! a',cb)
        },
      ],
      done
    );
  } );

  it( 'should attach all middleware serving a given request to the same object', function(done) {
    serve(
      composable()
        .use(function () {
          this.msg= 'a';
          this.res.emit('next');
        })
        .use(function (next) {
          this.msg+= 'b';
          next();
        })
        .use(function (req,res,next) {
          this.msg+= 'c';
          next();
        })
        .use(composable()
          .use(function (next) {
            this.msg+= 'd';
            next();
          })
          .use(function (next) {
            this.msg+= 'e';
            next();
          })
        )
        .use(function (next) {
          next('error!')
        })
        .use(function (next) {
          this.msg+= 'f';
          next();
        })
        .use(function (err,next) {
          this.res.send(err+' '+this.msg);
        })
        .use(send_msg)
      ,
      [
        function(cb) {
          get('/','error! abcde',cb)
        },
      ],
      done
    );
  } );
  it( 'should assure that there is a context and it is not the global object', function(done) {
    serve(
      composable()
      .use(function () {
        this.res.send(!this.global && typeof(this._middleware_common_object));
      })
      ,
      [
        function(cb) {
          get('/','function',cb)
        },
      ],
      done
    )
  } );
  it( 'should advise that the global object is to be protected', function(){
    assert(composable.is_protected_context(global))
  } );
} );
