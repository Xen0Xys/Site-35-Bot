import {CallHandler, ClassSerializerInterceptor, ExecutionContext, Injectable} from "@nestjs/common";
import {Reflector} from "@nestjs/core";
import {Observable} from "rxjs";

@Injectable()
export class AppClassSerializerInterceptor extends ClassSerializerInterceptor {
    constructor(reflector: Reflector) {
        super(reflector);
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        if (context.getType() !== "http") return next.handle();
        return super.intercept(context, next);
    }
}
