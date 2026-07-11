import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { calendarService } from "../services/calendar.service";
import { createCalendarEventSchema, updateCalendarEventSchema } from "../validators/staff.validator";

export const calendarController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await calendarService.list(req.auth!.schoolId);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createCalendarEventSchema.parse(req.body);
    const event = await calendarService.create(req.auth!.schoolId, input);
    res.status(201).json({ success: true, data: event });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = updateCalendarEventSchema.parse(req.body);
    const event = await calendarService.update(req.auth!.schoolId, req.params.id, input);
    res.json({ success: true, data: event });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await calendarService.remove(req.auth!.schoolId, req.params.id);
    res.json({ success: true, data: null });
  }),
};
