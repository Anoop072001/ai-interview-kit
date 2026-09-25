import { Router } from "express";
import { requireAuth } from "../auth/session.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "./controller.js";

export const kitsRouter = Router();
kitsRouter.use(requireAuth);

kitsRouter.post("/", asyncHandler(controller.createKit));
kitsRouter.post("/bulk", asyncHandler(controller.createBulkKits));
kitsRouter.get("/", asyncHandler(controller.listKits));
kitsRouter.get("/:id", asyncHandler(controller.getKit));
kitsRouter.get("/:id/status", asyncHandler(controller.getKitStatus));
kitsRouter.delete("/:id", asyncHandler(controller.deleteKit));
kitsRouter.post("/:id/regenerate", asyncHandler(controller.regenerate));

kitsRouter.patch("/:id/company-brief", asyncHandler(controller.editCompanyBrief));

kitsRouter.post("/:id/questions", asyncHandler(controller.addQuestion));
kitsRouter.patch("/:id/questions/order", asyncHandler(controller.reorderQuestions));
kitsRouter.patch("/:id/questions/:qid", asyncHandler(controller.editQuestion));
kitsRouter.delete("/:id/questions/:qid", asyncHandler(controller.deleteQuestion));

kitsRouter.post("/:id/flashcards", asyncHandler(controller.addFlashcard));
kitsRouter.patch("/:id/flashcards/:fid", asyncHandler(controller.editFlashcard));
kitsRouter.delete("/:id/flashcards/:fid", asyncHandler(controller.deleteFlashcard));

kitsRouter.post("/:id/practice/attempts", asyncHandler(controller.recordPracticeAttempt));
kitsRouter.get("/:id/practice/session", asyncHandler(controller.getPracticeSession));
