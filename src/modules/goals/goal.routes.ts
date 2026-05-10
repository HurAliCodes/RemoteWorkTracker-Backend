import express from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createGoalController,
  deleteGoalController,
  getAllGoalsController,
  getGoalByIdController,
  updateGoalController,
  updateGoalProgressController,
} from './goal.controller';
import { createGoalSchema, updateGoalProgressSchema, updateGoalSchema } from './goal.validation';

const router = express.Router();

router.post('/', validate(createGoalSchema), createGoalController);
router.get('/', authenticateJWT, getAllGoalsController);
router.get('/:id', getGoalByIdController);
router.patch('/:id', validate(updateGoalSchema), updateGoalController);
router.delete('/:id', deleteGoalController);
router.patch('/:id/progress', validate(updateGoalProgressSchema), updateGoalProgressController);

export default router;
