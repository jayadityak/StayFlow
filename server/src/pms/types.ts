export interface PmsReservation {
  confirmationNumber: string;
  guestFirstName: string;
  guestLastName: string;
  email: string;
  phone?: string;
  roomNumber: string;
  roomType: string;
  arrivalDate: string;
  departureDate: string;
  status: 'RESERVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
  adults: number;
  children: number;
  rateCode?: string;
  rateAmount?: number;
  vipStatus?: string;
  specialRequests?: string;
}

export interface PmsProvider {
  readonly name: string;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
  getArrivals(date: string): Promise<PmsReservation[]>;
  getDepartures(date: string): Promise<PmsReservation[]>;
  getInHouseGuests(): Promise<PmsReservation[]>;
  getReservation(confirmationNumber: string): Promise<PmsReservation | null>;
}

export interface PmsConfig {
  provider: string;
  hotelId: string;
  hotelCode: string;
}
