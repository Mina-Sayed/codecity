import { saveOrder } from "./order-repository.js";
export { notify } from "./notify.js";

export class OrderService {
  async place(total: number) {
    if (total <= 0) throw new Error("invalid total");
    return saveOrder(total);
  }
}
