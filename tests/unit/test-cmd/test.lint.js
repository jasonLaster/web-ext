/* @flow */
import {it, describe} from 'mocha';
import {assert} from 'chai';
import sinon from 'sinon';

import defaultLintCommand from '../../../src/cmd/lint';
import {FileFilter} from '../../../src/cmd/build';
import {fake, makeSureItFails} from '../helpers';

type setUpParams = {|
  createLinter?: Function,
  fileFilter?: Function,
|}

describe('lint', () => {

  function setUp({createLinter, fileFilter}: setUpParams = {}) {
    const lintResult = '<lint.run() result placeholder>';
    const runLinter = sinon.spy(() => Promise.resolve(lintResult));
    if (!createLinter) {
      createLinter = sinon.spy(() => {
        return {run: runLinter};
      });
    }
    return {
      lintResult,
      createLinter,
      runLinter,
      lint: (params = {}) => {
        return defaultLintCommand({
          sourceDir: '/fake/source/dir',
          ...params,
        }, {
          createLinter,
          fileFilter,
        });
      },
    };
  }

  it('creates and runs a linter', () => {
    const {lint, createLinter, runLinter, lintResult} = setUp();
    return lint().then((actualLintResult) => {
      assert.equal(actualLintResult, lintResult);
      assert.equal(createLinter.called, true);
      assert.equal(runLinter.called, true);
    });
  });

  it('fails when the linter fails', () => {
    const createLinter = () => {
      return {
        run: () => Promise.reject(new Error('some error from the linter')),
      };
    };
    const {lint} = setUp({createLinter});
    return lint().then(makeSureItFails(), (error) => {
      assert.match(error.message, /error from the linter/);
    });
  });

  it('runs as a binary', () => {
    const {lint, createLinter} = setUp();
    return lint().then(() => {
      const args = createLinter.firstCall.args[0];
      assert.equal(args.runAsBinary, true);
    });
  });

  it('passes sourceDir to the linter', () => {
    const {lint, createLinter} = setUp();
    return lint({sourceDir: '/some/path'}).then(() => {
      const config = createLinter.firstCall.args[0].config;
      assert.equal(config._[0], '/some/path');
    });
  });

  it('passes warningsAsErrors to the linter', () => {
    const {lint, createLinter} = setUp();
    return lint({warningsAsErrors: true}).then(() => {
      const config = createLinter.firstCall.args[0].config;
      assert.equal(config.warningsAsErrors, true);
    });
  });

  it('passes warningsAsErrors undefined to the linter', () => {
    const {lint, createLinter} = setUp();
    return lint().then(() => {
      const config = createLinter.firstCall.args[0].config;
      assert.equal(config.warningsAsErrors, undefined);
    });
  });

  it('configures the linter when verbose', () => {
    const {lint, createLinter} = setUp();
    return lint({verbose: true}).then(() => {
      const config = createLinter.firstCall.args[0].config;
      assert.equal(config.logLevel, 'debug');
      assert.equal(config.stack, true);
    });
  });

  it('configures the linter when not verbose', () => {
    const {lint, createLinter} = setUp();
    return lint({verbose: false}).then(() => {
      const config = createLinter.firstCall.args[0].config;
      assert.equal(config.logLevel, 'fatal');
      assert.equal(config.stack, false);
    });
  });

  it('passes through linter configuration', () => {
    const {lint, createLinter} = setUp();
    return lint({
      pretty: true,
      metadata: true,
      output: 'json',
      boring: true,
      selfHosted: true,
    }).then(() => {
      const config = createLinter.firstCall.args[0].config;
      assert.strictEqual(config.pretty, true);
      assert.strictEqual(config.metadata, true);
      assert.strictEqual(config.output, 'json');
      assert.strictEqual(config.boring, true);
      assert.strictEqual(config.selfHosted, true);
    });
  });

  it('passes a file filter to the linter', () => {
    const fileFilter = fake(new FileFilter());
    const {lint, createLinter} = setUp({fileFilter});
    return lint()
      .then(() => {
        assert.equal(createLinter.called, true);
        const config = createLinter.firstCall.args[0].config;
        assert.isFunction(config.shouldScanFile);

        // Simulate how the linter will use this callback.
        config.shouldScanFile('manifest.json');
        assert.equal(fileFilter.wantFile.called, true);
        assert.equal(fileFilter.wantFile.firstCall.args[0], 'manifest.json');
      });
  });

});
