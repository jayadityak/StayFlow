import crypto from 'crypto';
import { PmsProvider, PmsReservation } from '../types';

/**
 * ─────────────────────────────────────────────────────────────────
 * HOTELOGIX PMS PROVIDER
 * ─────────────────────────────────────────────────────────────────
 *
 * Hotelogix uses an XML-over-HTTP API with HMAC-SHA1 authentication.
 *
 * Official API docs:
 *   Front Desk API → https://developer.hotelogix.net/out/hapi/fd/
 *   Admin API      → https://developer.hotelogix.net/out/hapi/ad/
 *   Web API        → https://developer.hotelogix.net/out/hapi/wb/
 *
 * ── HOW TO GET CREDENTIALS ──────────────────────────────────────
 * Email developer@hotelogix.com with:
 *   - Your hotel/company name
 *   - What you're building (e.g. "guest experience platform")
 *   - Request: consumerSecret, accessSecret, sandbox access
 *
 * They will provision:
 *   consumerSecret  — used to generate the initial access key
 *   accessSecret    — used to sign every API request (HMAC-SHA1)
 *   hotelCode       — the property's unique identifier in Hotelogix
 * ────────────────────────────────────────────────────────────────
 */

// The Front Desk API is used for all guest/reservation operations.
// The Admin API would be used for configuration (not needed here).
const HOTELOGIX_FD_URL = 'https://developer.hotelogix.net/out/hapi/fd/';

export interface HotelogixConfig {
  hotelCode: string;       // Property code assigned by Hotelogix
  consumerSecret: string;  // Initial auth key (think of it as username)
  accessSecret: string;    // Signing key (think of it as password for HMAC)
}

export class HotelogixProvider implements PmsProvider {
  readonly name = 'hotelogix';
  private config: HotelogixConfig;

  constructor(config: HotelogixConfig) {
    this.config = config;
  }

  // ── AUTHENTICATION ──────────────────────────────────────────────

  /**
   * Generates the HMAC-SHA1 request signature.
   *
   * Hotelogix requires every request to be signed. The signature is
   * produced by running the raw XML request body through HMAC-SHA1
   * using your accessSecret as the key. The result goes into the
   * X-HAPI-Signature HTTP header.
   *
   * Docs: "X-HAPI-Signature: hash_hmac('sha1', requestBody, accessSecret)"
   */
  private generateSignature(requestBody: string): string {
    return crypto
      .createHmac('sha1', this.config.accessSecret)
      .update(requestBody)
      .digest('hex');
  }

  // ── HTTP ────────────────────────────────────────────────────────

  /**
   * Sends an XML POST to the Hotelogix Front Desk API.
   *
   * Every request to Hotelogix follows the same pattern:
   *   1. Build an XML body describing what you want
   *   2. Sign it with HMAC-SHA1
   *   3. POST it to the FD endpoint
   *   4. Parse the XML response
   */
  private async postXml(xmlBody: string): Promise<string> {
    const signature = this.generateSignature(xmlBody);

    const response = await fetch(HOTELOGIX_FD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        // This is the authentication header Hotelogix checks on every request
        'X-HAPI-Signature': signature,
      },
      body: xmlBody,
    });

    if (!response.ok) {
      throw new Error(`Hotelogix API error: HTTP ${response.status} — ${response.statusText}`);
    }

    return response.text(); // Returns raw XML string
  }

  // ── XML HELPERS ─────────────────────────────────────────────────

  /**
   * Extracts the text value of a single XML tag.
   *
   * Example: extractXmlValue('<FirstName>Arjun</FirstName>', 'FirstName')
   *          → 'Arjun'
   *
   * We do this with regex rather than adding a full XML parser dependency.
   * Works fine for Hotelogix's flat XML structure.
   */
  private extractXmlValue(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`));
    return match?.[1]?.trim() ?? '';
  }

  /**
   * Extracts all occurrences of an XML block as an array.
   *
   * Used to get the list of reservations from a response like:
   *   <Reservations>
   *     <Reservation>...</Reservation>
   *     <Reservation>...</Reservation>
   *   </Reservations>
   */
  private extractXmlBlocks(xml: string, tag: string): string[] {
    const blocks: string[] = [];
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'g');
    let match;
    while ((match = regex.exec(xml)) !== null) {
      blocks.push(match[0]);
    }
    return blocks;
  }

  /**
   * Builds a standard Hotelogix XML request envelope.
   *
   * All API calls share this structure — they differ only in the
   * Method name and the Params content.
   *
   * NOTE: Verify this exact XML schema against official Hotelogix docs
   * when you have real credentials. Field names may vary by API version.
   *
   * Example output:
   *   <?xml version="1.0"?>
   *   <Request>
   *     <HotelCode>RPS001</HotelCode>
   *     <Method>GetArrivals</Method>
   *     <Params>
   *       <ArrivalDate>2026-06-04</ArrivalDate>
   *     </Params>
   *   </Request>
   */
  private buildRequest(method: string, params: Record<string, string>): string {
    const paramsXml = Object.entries(params)
      .map(([key, val]) => `    <${key}>${val}</${key}>`)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <HotelCode>${this.config.hotelCode}</HotelCode>
  <Method>${method}</Method>
  <Params>
${paramsXml}
  </Params>
</Request>`;
  }

  // ── RESPONSE PARSING ────────────────────────────────────────────

  /**
   * Maps a Hotelogix XML reservation block to our internal PmsReservation format.
   *
   * The XML field names (ConfirmationNo, FirstName, etc.) are Hotelogix's
   * property names. Our PmsReservation interface is our internal shape —
   * it's the same regardless of which PMS we're talking to.
   *
   * NOTE: When testing with real credentials, compare this mapping against
   * actual XML responses and adjust field names if needed. Hotelogix may
   * use slightly different tag names (e.g. 'GuestFirstName' vs 'FirstName').
   */
  private parseReservation(xml: string): PmsReservation {
    const rawStatus = this.extractXmlValue(xml, 'Status').toUpperCase();

    // Map Hotelogix status strings to our internal status enum
    const statusMap: Record<string, PmsReservation['status']> = {
      'RESERVED':    'RESERVED',
      'CHECKED_IN':  'CHECKED_IN',
      'CHECKEDIN':   'CHECKED_IN',  // Hotelogix may use either format
      'CHECKED_OUT': 'CHECKED_OUT',
      'CHECKEDOUT':  'CHECKED_OUT',
      'CANCELLED':   'CANCELLED',
      'CANCELED':    'CANCELLED',   // US spelling variant
      'NO_SHOW':     'NO_SHOW',
      'NOSHOW':      'NO_SHOW',
    };

    return {
      confirmationNumber: this.extractXmlValue(xml, 'ConfirmationNo'),
      guestFirstName:     this.extractXmlValue(xml, 'FirstName'),
      guestLastName:      this.extractXmlValue(xml, 'LastName'),
      // Hotelogix may not always return an email; fallback to a derived address
      email:              this.extractXmlValue(xml, 'Email') ||
                          `${this.extractXmlValue(xml, 'ConfirmationNo').toLowerCase()}@hotelogix.guest`,
      phone:              this.extractXmlValue(xml, 'Phone') || undefined,
      roomNumber:         this.extractXmlValue(xml, 'RoomNo'),    // Hotelogix tag is 'RoomNo'
      roomType:           this.extractXmlValue(xml, 'RoomType') || 'standard',
      arrivalDate:        this.extractXmlValue(xml, 'ArrivalDate'),
      departureDate:      this.extractXmlValue(xml, 'DepartureDate'),
      status:             statusMap[rawStatus] ?? 'RESERVED',
      adults:             parseInt(this.extractXmlValue(xml, 'Adults')   || '1', 10),
      children:           parseInt(this.extractXmlValue(xml, 'Children') || '0', 10),
      rateCode:           this.extractXmlValue(xml, 'RateCode')   || undefined,
      rateAmount:         parseFloat(this.extractXmlValue(xml, 'RateAmount') || '0') || undefined,
      vipStatus:          this.extractXmlValue(xml, 'VIPCode')    || undefined, // Hotelogix calls it VIPCode
      specialRequests:    this.extractXmlValue(xml, 'SpecialRequest') || undefined,
    };
  }

  // ── PmsProvider INTERFACE METHODS ───────────────────────────────

  /**
   * Checks if the Hotelogix connection is alive.
   * Called by GET /api/pms/status — shown as the status card in the dashboard.
   */
  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const xml = this.buildRequest('HealthCheck', {});
      await this.postXml(xml);
      return { ok: true, message: 'Hotelogix connected successfully' };
    } catch (err: any) {
      return { ok: false, message: err.message ?? 'Connection failed' };
    }
  }

  /**
   * Returns reservations arriving on the given date.
   * Called by GET /api/pms/arrivals?date=YYYY-MM-DD
   *
   * Use case: Front desk sees who's checking in today and can
   * pre-assign StayFlow guest tokens before the guest arrives.
   */
  async getArrivals(date: string): Promise<PmsReservation[]> {
    const xml = this.buildRequest('GetArrivals', { ArrivalDate: date });
    const response = await this.postXml(xml);
    const blocks = this.extractXmlBlocks(response, 'Reservation');
    return blocks.map(b => this.parseReservation(b));
  }

  /**
   * Returns reservations departing on the given date.
   * Called by GET /api/pms/departures?date=YYYY-MM-DD
   *
   * Use case: Housekeeping knows which rooms are freeing up today.
   */
  async getDepartures(date: string): Promise<PmsReservation[]> {
    const xml = this.buildRequest('GetDepartures', { DepartureDate: date });
    const response = await this.postXml(xml);
    const blocks = this.extractXmlBlocks(response, 'Reservation');
    return blocks.map(b => this.parseReservation(b));
  }

  /**
   * Returns all guests currently checked in at the hotel.
   * Called by GET /api/pms/in-house
   *
   * This is the PRIMARY sync method. syncReservations() in sync.ts
   * calls this and upserts GuestSession records so every in-house
   * guest automatically gets a StayFlow session.
   */
  async getInHouseGuests(): Promise<PmsReservation[]> {
    const xml = this.buildRequest('GetInHouseGuests', {});
    const response = await this.postXml(xml);
    const blocks = this.extractXmlBlocks(response, 'Reservation');
    return blocks.map(b => this.parseReservation(b));
  }

  /**
   * Fetches a single reservation by confirmation number.
   * Used when drilling into a specific guest from the dashboard.
   */
  async getReservation(confirmationNumber: string): Promise<PmsReservation | null> {
    try {
      const xml = this.buildRequest('GetReservation', { ConfirmationNo: confirmationNumber });
      const response = await this.postXml(xml);
      const blocks = this.extractXmlBlocks(response, 'Reservation');
      return blocks.length > 0 ? this.parseReservation(blocks[0]) : null;
    } catch {
      return null; // Reservation not found or API error — return null gracefully
    }
  }
}
