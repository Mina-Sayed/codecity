import { BaseService } from "@shared/base-service";

export class AppService extends BaseService {
  startedAt() {
    return this.now();
  }
}
