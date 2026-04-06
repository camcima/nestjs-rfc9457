import { Module } from '@nestjs/common';
import { Rfc9457Module } from '../../../src/rfc9457.module';
import { AppController } from './app.controller';

@Module({
  imports: [Rfc9457Module.forRoot()],
  controllers: [AppController],
})
export class DefaultAppModule {}

@Module({
  imports: [
    Rfc9457Module.forRoot({
      instanceStrategy: 'request-uri',
      typeBaseUri: 'https://api.example.com/problems',
    }),
  ],
  controllers: [AppController],
})
export class ConfiguredAppModule {}

@Module({
  imports: [
    Rfc9457Module.forRoot({
      catchAllExceptions: true,
    }),
  ],
  controllers: [AppController],
})
export class CatchAllAppModule {}

@Module({
  imports: [
    Rfc9457Module.forRoot({
      exceptionMapper: (exception) => {
        if (exception instanceof Error && exception.message.includes('Balance')) {
          return {
            type: 'https://api.example.com/problems/mapper-override',
            status: 422,
            title: 'Mapper Override',
            detail: exception.message,
          };
        }
        return null;
      },
    }),
  ],
  controllers: [AppController],
})
export class MapperAppModule {}
