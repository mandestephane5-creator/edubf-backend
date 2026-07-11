import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { credentialsExportService } from "../services/credentialsExport.service";

export const credentialsExportController = {
  exportForClass: asyncHandler(async (req: Request, res: Response) => {
    const { className, rows } = await credentialsExportService.regenerateAndListForClass(req.auth!.schoolId, req.params.classId);

    const doc = credentialsExportService.generatePdf(className, rows);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="identifiants-${className.replace(/\s+/g, "-")}.pdf"`);
    doc.pipe(res);
    doc.end();
  }),
};
