import { StatefulService, mutation } from 'services/core/stateful-service';
import { NicoliveClient, isOk } from './NicoliveClient';
import { AddFilterRecord, FilterRecord } from './ResponseTypes';
import { Inject } from 'services/core/injector';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { NicoliveProgramStateService } from 'services/nicolive-program/state';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { NicoliveFailure } from './NicoliveFailure';
import { WrappedChat } from './WrappedChat';
import { Subject } from 'rxjs';

interface INicoliveCommentFilterState {
  filters: FilterRecord[];
}

export class NicoliveCommentFilterService extends StatefulService<INicoliveCommentFilterState> {
  @Inject() private nicoliveProgramService: NicoliveProgramService;
  @Inject('NicoliveProgramStateService') private stateService: NicoliveProgramStateService;

  private client = new NicoliveClient();

  static initialState = {
    filters: [] as FilterRecord[],
  };

  private stateChangeSubject = new Subject<INicoliveCommentFilterState>();
  stateChange = this.stateChangeSubject.asObservable();

  applyFilter<T extends WrappedChat>(wrapped: T) {
    if (wrapped.type === 'normal') {
      for (const record of this.state.filters) {
        if (
          (record.type === 'word' && wrapped.value.content?.includes(record.body)) ||
          (record.type === 'user' && wrapped.value.user_id === record.body) ||
          (record.type === 'command' && wrapped.value.mail?.split(/\s/).includes(record.body))
        ) {
          return { ...wrapped, filtered: true };
        }
      }
    }
    if (wrapped.filtered) return { ...wrapped, filtered: false };
    return wrapped;
  }

  private get programID() {
    return this.nicoliveProgramService.state.programID;
  }

  get filters() {
    return this.state.filters;
  }

  init() {
    super.init();

    this.nicoliveProgramService.stateChange
      .pipe(
        map(({ programID }) => programID),
        distinctUntilChanged(),
      )
      .subscribe(() => {
        this.fetchFilters().catch(caught => {
          if (caught instanceof NicoliveFailure) {
            // ignore
          } else {
            throw caught;
          }
        });
      });
  }

  async fetchFilters() {
    if (process.env.DEV_SERVER) {
      this.updateFilters(
        [
          {
            type: 'word',
            body: 'test',
            createdAt: '2021-01-01T00:00:00+09:00',
            userId: 2,
            userName: '戀塚',
          } as Pick<FilterRecord, 'type' | 'body' | 'createdAt' | 'userId' | 'userName'>,
          {
            type: 'user',
            body: '3', // 悪い人
            createdAt: '2021-01-01T00:00:00+09:00',
            Memo: '悪い人',
          } as Pick<FilterRecord, 'type' | 'body' | 'createdAt' | 'userId' | 'userName'>,
        ].map((record, id) => ({ id, ...record })),
      );
    }
    const result = await this.client.fetchFilters(this.programID);
    if (!isOk(result)) {
      throw NicoliveFailure.fromClientError('fetchFilters', result);
    }

    this.updateFilters(result.value);
  }

  async addFilter(record: AddFilterRecord) {
    if (process.env.DEV_SERVER) {
      return;
    }
    const result = await this.client.addFilters(this.programID, [record]);
    if (!isOk(result)) {
      throw NicoliveFailure.fromClientError('addFilters', result);
    }
    return this.fetchFilters();
  }

  async deleteFilters(ids: number[]) {
    if (process.env.DEV_SERVER) {
      return;
    }

    const result = await this.client.deleteFilters(this.programID, ids);
    if (!isOk(result)) {
      throw NicoliveFailure.fromClientError('deleteFilters', result);
    }

    this.deleteFiltersCache(ids);
  }

  findFilterCache(id: number): FilterRecord | undefined {
    return this.state.filters.find(rec => rec.id === id);
  }

  addFilterCache(record: FilterRecord) {
    if (!this.state.filters.some(rec => rec.id === record.id)) {
      const filters = [...this.state.filters, record];
      this.updateFilters(filters);
    } else {
      console.warn('addFilterCache: already exists', record);
    }
  }

  deleteFiltersCache(ids: number[]) {
    const filters = this.state.filters.filter(rec => !ids.includes(rec.id));
    this.updateFilters(filters);
  }

  private updateFilters(filters: FilterRecord[]) {
    this.UPDATE_FILTERS(filters);
    this.stateChangeSubject.next({ filters });
  }

  @mutation()
  private UPDATE_FILTERS(filters: FilterRecord[]) {
    this.state = { filters };
  }
}
