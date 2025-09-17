/* eslint-disable no-console */
import chalk from 'chalk';

const log = {
  error: (...msg: unknown[]) => console.error(chalk.red('[ERROR]'), ...msg),
  warn: (...msg: unknown[]) => console.warn(chalk.yellow('[WARN]'), ...msg),
  info: (...msg: unknown[]) => console.log(chalk.blue('[INFO]'), ...msg),
  success: (...msg: unknown[]) => console.log(chalk.green('[SUCCESS]'), ...msg),
};

// export default log;
export { log };
