/**
 * vitest 全局 setup：在每个测试文件运行前关闭 logger，避免控制台污染断言输出。
 */
import { setLoggerEnabled } from '#utils/logger';

setLoggerEnabled(false);
