import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MatchSimulatorService } from './match-simulator.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'matches',
})
export class MatchesGateway {
  private readonly logger = new Logger(MatchesGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly simulator: MatchSimulatorService) {}

  @SubscribeMessage('joinMatch')
  handleJoinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    const room = `match_${data.matchId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: 'joined', room };
  }

  @SubscribeMessage('startLiveSimulation')
  async handleStartLiveSimulation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    const room = `match_${data.matchId}`;
    const result = await this.simulator.simulateMatch(BigInt(data.matchId));

    // Stream events chronologically to room
    if ('events' in result && Array.isArray(result.events)) {
      let delay = 0;
      for (const event of result.events) {
        setTimeout(() => {
          this.server.to(room).emit('matchEvent', event);
        }, delay);
        delay += 1000; // 1s per event for live streaming effect
      }

      setTimeout(() => {
        this.server.to(room).emit('matchFinished', result);
      }, delay + 500);
    }

    return { status: 'simulation_started', matchId: data.matchId };
  }
}
