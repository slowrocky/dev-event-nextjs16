import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

import connectDB from "@/lib/mongodb";
import Event from "@/database/event.model";

/**
 * Creates a new event from multipart form data, uploads the provided image to Cloudinary, and stores the event in the database.
 *
 * @param req - Incoming NextRequest containing multipart form data with fields:
 *   - `image` (file): required image file to upload
 *   - `tags` (JSON string): array of tags
 *   - `agenda` (JSON string): array of agenda items
 *   - other event fields as form entries
 * @returns A NextResponse with a JSON body:
 *   - On success (201): `{ message: "Event created successfully", event }` where `event` is the created document
 *   - On client error (400): `{ message: "Invalid JSON data format" }` or `{ message: "Image file is required" }`
 *   - On server error (500): `{ message: "Event Creation Failed", error }`
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const formData = await req.formData();

    let event;

    try {
      event = Object.fromEntries(formData.entries());
    } catch (e) {
      return NextResponse.json(
        { message: "Invalid JSON data format" },
        { status: 400 },
      );
    }

    const file = formData.get("image") as File;

    if (!file)
      return NextResponse.json(
        { message: "Image file is required" },
        { status: 400 },
      );

    let tags = JSON.parse(formData.get("tags") as string);
    let agenda = JSON.parse(formData.get("agenda") as string);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { resource_type: "image", folder: "DevEvent" },
          (error, results) => {
            if (error) return reject(error);

            resolve(results);
          },
        )
        .end(buffer);
    });

    event.image = (uploadResult as { secure_url: string }).secure_url;

    const createdEvent = await Event.create({
      ...event,
      tags: tags,
      agenda: agenda,
    });

    return NextResponse.json(
      { message: "Event created successfully", event: createdEvent },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        message: "Event Creation Failed",
        error: e instanceof Error ? e.message : "Unknown",
      },
      { status: 500 },
    );
  }
}

/**
 * Retrieve all events from the database sorted by newest first.
 *
 * @returns A JSON HTTP response containing a `message` and an `events` array on success (status 200); on failure, a JSON response with `message` and `error` (status 500).
 */
export async function GET() {
  try {
    await connectDB();

    const events = await Event.find().sort({ createdAt: -1 });

    return NextResponse.json(
      { message: "Events fetched successfully", events },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      { message: "Event fetching failed", error: e },
      { status: 500 },
    );
  }
}