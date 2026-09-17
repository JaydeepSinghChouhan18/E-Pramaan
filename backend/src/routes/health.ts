import { Router } from 'express';
import { HealthCheckResponse } from '@e-pramaan/shared';
import { ApiResponseHelper } from '../utils/apiResponse.js';
import { config } from '../config/env.js';

const router = Router();

router.get('/health', (_req, res) => {
  const healthData: HealthCheckResponse = {
    status: 'healthy',
    service: 'e-Pramaan Core Backend Service',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    version: '1.0.0'
  };

  return ApiResponseHelper.success(res, healthData, 'e-Pramaan backend service is healthy');
});

export default router;
