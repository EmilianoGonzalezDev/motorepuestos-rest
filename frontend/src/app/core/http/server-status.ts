import { Injectable, signal } from '@angular/core';

export type ServerState = 'ready' | 'warming' | 'unavailable';

/**
 * Whether the API is answering. On the free hosting plan the server sleeps when idle and the
 * database takes a while to resume; meanwhile the API answers 503 "app.warming_up".
 */
@Injectable({ providedIn: 'root' })
export class ServerStatus {
  readonly state = signal<ServerState>('ready');

  markWarming(): void {
    if (this.state() !== 'warming') this.state.set('warming');
  }

  markReady(): void {
    if (this.state() !== 'ready') this.state.set('ready');
  }

  markUnavailable(): void {
    this.state.set('unavailable');
  }
}
