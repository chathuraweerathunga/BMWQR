-- The location a guest most recently scanned a QR code at. Written only by
-- the server-side QR scan flow; requests are routed from this (or the
-- stay's own room), never from a client-supplied location id.
ALTER TABLE "guest_sessions" ADD COLUMN "currentLocationId" TEXT;

ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_businessId_currentLocationId_fkey" FOREIGN KEY ("businessId", "currentLocationId") REFERENCES "locations"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
