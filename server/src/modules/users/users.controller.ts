import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  changePasswordSchema,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
} from "@/modules/users/users.schema.js";
import * as usersService from "@/modules/users/users.service.js";

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const users = await usersService.listUsers(req.user!);
  res.json({ users });
});

export const getUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.getUser(req.user!, req.params.id);
  res.json({ user });
});

export const createUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const user = await usersService.createUser(req.user!, input);
  res.status(201).json({ user });
});

export const updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateUserSchema.parse(req.body);
  const user = await usersService.updateUser(req.user!, req.params.id, input);
  res.json({ user });
});

export const changeOwnPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await usersService.changeOwnPassword(req.user!, currentPassword, newPassword);
  res.status(204).send();
});

export const resetUserPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = resetPasswordSchema.parse(req.body);
  await usersService.resetUserPassword(req.user!, req.params.id, input);
  res.status(204).send();
});

export const deleteUserHandler = asyncHandler(async (req: Request, res: Response) => {
  await usersService.deleteUser(req.user!, req.params.id);
  res.status(204).send();
});
