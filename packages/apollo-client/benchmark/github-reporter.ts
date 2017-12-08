import GithubAPI from 'github';
import { bsuite, groupPromises, log } from './util';
import { thresholds } from './thresholds';

export function collectAndReportBenchmarks() {
  const github = eval('new require("github")()') as GithubAPI;
  const commitSHA = process.env.TRAVIS_PULL_REQUEST_SHA || process.env.TRAVIS_COMMIT || '';

  github.authenticate({
    type: 'oauth',
    token: process.env.DANGER_GITHUB_API_TOKEN || '',
  });

  github.repos.createStatus({
    owner: 'apollographql',
    repo: 'apollo-client',
    sha: commitSHA,
    context: 'Benchmark',
    description: 'Evaluation is in progress!',
    state: 'pending',
  });

  Promise.all(groupPromises)
    .then(() => {
      log('Running benchmarks.');
      return new Promise<{ [name: string]: { mean: number; moe: number } }>(
        resolve => {
          const retMap: { [name: string]: { mean: number; moe: number } } = {};

          bsuite
            .on('error', (error: any) => {
              log('Error: ', error);
            })
            .on('cycle', (event: any) => {
              retMap[event.target.name] = {
                mean: event.target.stats.mean * 1000,
                moe: event.target.stats.moe * 1000,
              };
              log('Mean time in ms: ', event.target.stats.mean * 1000);
              log(String(event.target));
              log('');
            })
            .on('complete', (_: any) => {
              resolve(retMap);
            })
            .run({ async: false });
        },
      );
    })
    .then(res => {
      let message = '';
      let pass = false;
      Object.keys(res).forEach(element => {
        if (!thresholds[element]) {
          console.error(`Threshold not defined for "${element}"`);
          if (message === '') {
            message = `Threshold not defined for "${element}"`;
            pass = false;
          }
        } else {
          if (res[element].mean - res[element].moe > thresholds[element]) {
            const perfDropMessage = `Performance drop detected for benchmark: "${
              element
            }", ${res[element].mean} - ${res[element].moe} > ${
              thresholds[element]
            }`;
            console.error(perfDropMessage);
            if (message === '') {
              message = perfDropMessage;
              pass = false;
            }
          } else {
            console.log(
              `No performance drop detected for benchmark: "${element}", ${
                res[element].mean
              } - ${res[element].moe} <= ${thresholds[element]}`,
            );
          }
        }
      });

      if (message === '') {
        message = 'All benchmarks are under the defined thresholds!';
        pass = true;
      }

      console.log('Reporting benchmarks to GitHub status...');

      return github.repos
        .createStatus({
          owner: 'apollographql',
          repo: 'apollo-client',
          sha: commitSHA,
          context: 'Benchmark',
          description: message,
          state: pass ? 'success' : 'error',
        })
        .then(() => {
          console.log('Published benchmark results to GitHub status');
        });
    });
}
