// Code generated by mockery v2.53.4. DO NOT EDIT.

// Regenerate this file using `make einterfaces-mocks`.

package mocks

import (
	model "github.com/mattermost/mattermost/server/public/model"
	mock "github.com/stretchr/testify/mock"
)

// ElasticsearchIndexerInterface is an autogenerated mock type for the ElasticsearchIndexerInterface type
type ElasticsearchIndexerInterface struct {
	mock.Mock
}

// MakeWorker provides a mock function with no fields
func (_m *ElasticsearchIndexerInterface) MakeWorker() model.Worker {
	ret := _m.Called()

	if len(ret) == 0 {
		panic("no return value specified for MakeWorker")
	}

	var r0 model.Worker
	if rf, ok := ret.Get(0).(func() model.Worker); ok {
		r0 = rf()
	} else {
		if ret.Get(0) != nil {
			r0 = ret.Get(0).(model.Worker)
		}
	}

	return r0
}

// NewElasticsearchIndexerInterface creates a new instance of ElasticsearchIndexerInterface. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
// The first argument is typically a *testing.T value.
func NewElasticsearchIndexerInterface(t interface {
	mock.TestingT
	Cleanup(func())
}) *ElasticsearchIndexerInterface {
	mock := &ElasticsearchIndexerInterface{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}
