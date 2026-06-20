// jest 환경에서 네이티브 AsyncStorage 모듈을 인메모리 목으로 대체.
// (persist를 쓰는 zustand 스토어를 import하는 테스트가 네이티브 모듈 null로 깨지는 것을 방지)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
